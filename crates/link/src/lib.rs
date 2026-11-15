//! Outbound link queue for std nodes (satellite, hub): encodes each message to
//! a CRC-protected frame and orders frames by priority.

use nasamars_core::frame::{self, Error, Message};
use nasamars_core::ContactWindow;
use nasamars_core::queue::PriorityQueue;

/// Largest encoded frame: one 4 KiB tile plus header, CRC and COBS overhead.
pub const MAX_FRAME: usize = 4352;

#[derive(Debug, PartialEq)]
pub enum EnqueueError {
    /// The message does not fit in `MAX_FRAME` or cannot be encoded.
    Encode(Error),
    /// Queue is full of items at least as urgent as this one.
    Full,
}

pub struct Outbox<const N: usize> {
    queue: PriorityQueue<Vec<u8>, N>,
}

impl<const N: usize> Outbox<N> {
    pub fn new() -> Self {
        Self { queue: PriorityQueue::new() }
    }

    pub fn len(&self) -> usize {
        self.queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }

    /// Encodes and queues `msg`. `Ok(true)` means a less urgent frame was
    /// evicted to make room.
    pub fn enqueue(&mut self, msg: &Message<'_>) -> Result<bool, EnqueueError> {
        let mut buf = vec![0u8; MAX_FRAME];
        let frame = frame::encode(msg, &mut buf).map_err(EnqueueError::Encode)?;
        let bytes = frame.to_vec();
        match self.queue.push(msg.priority(), bytes) {
            Ok(evicted) => Ok(evicted.is_some()),
            Err(_) => Err(EnqueueError::Full),
        }
    }

    /// Length of the frame `next_frame` would return.
    pub fn peek_len(&self) -> Option<usize> {
        self.queue.peek().map(Vec::len)
    }

    /// Next frame to transmit: most urgent first, oldest first within a class.
    pub fn next_frame(&mut self) -> Option<Vec<u8>> {
        self.queue.pop()
    }
}

/// Gates an `Outbox` by contact window and a per-window byte budget
/// (`bytes_per_sec * window length`). Strict priority: if the most urgent
/// frame does not fit in what is left, nothing less urgent jumps ahead of it.
pub struct Transmitter {
    window: Option<ContactWindow>,
    bytes_per_sec: u32,
    sent: u64,
    /// Frames discarded because they can never fit in the current window.
    pub dropped_oversize: u32,
}

impl Transmitter {
    pub fn new(bytes_per_sec: u32) -> Self {
        Self { window: None, bytes_per_sec, sent: 0, dropped_oversize: 0 }
    }

    /// Sets the next window and resets its budget. An empty or inverted window
    /// (`end <= start`) is treated as no window.
    pub fn set_window(&mut self, w: ContactWindow) {
        self.window = (w.end > w.start).then_some(w);
        self.sent = 0;
    }

    fn capacity(w: &ContactWindow, bytes_per_sec: u32) -> u64 {
        (w.end - w.start).saturating_mul(bytes_per_sec as u64)
    }

    /// Next frame allowed on the air at `now` (UTC seconds), if any.
    pub fn poll<const N: usize>(&mut self, out: &mut Outbox<N>, now: u64) -> Option<Vec<u8>> {
        let w = self.window?;
        if now < w.start || now >= w.end {
            return None;
        }
        let capacity = Self::capacity(&w, self.bytes_per_sec);
        while let Some(len) = out.peek_len() {
            let len = len as u64;
            if len > capacity {
                out.next_frame();
                self.dropped_oversize += 1;
                continue;
            }
            if len > capacity - self.sent {
                return None;
            }
            self.sent += len;
            return out.next_frame();
        }
        None
    }
}

impl<const N: usize> Default for Outbox<N> {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nasamars_core::{
        CellPos, ContactWindow, EventKind, EventStatus, LayerId, PoiKind, PoiUpdate, SolarEvent,
        TileHeader, TileId,
    };

    fn alert() -> Message<'static> {
        Message::Event(SolarEvent {
            id: 1,
            kind: EventKind::Flare,
            issued_at: 1,
            arrival_start: 2,
            arrival_end: 3,
            severity: 3,
            dose_multiplier: 4.0,
            confidence: 70,
            status: EventStatus::Active,
            supersedes: 0,
        })
    }

    fn tile(data: &[u8]) -> Message<'_> {
        Message::Tile {
            header: TileHeader { layer: LayerId::Elevation, id: TileId { x: 0, y: 0 }, version: 1 },
            data,
        }
    }

    fn kind_of(mut frame: Vec<u8>) -> &'static str {
        match frame::decode(&mut frame).unwrap() {
            Message::Event(_) => "event",
            Message::Poi(_) => "poi",
            Message::Contact(_) => "contact",
            Message::Tile { .. } => "tile",
        }
    }

    #[test]
    fn drains_alert_then_route_then_base() {
        let data = vec![9u8; 4096];
        let mut out: Outbox<8> = Outbox::new();
        out.enqueue(&tile(&data)).unwrap();
        out.enqueue(&Message::Contact(ContactWindow { start: 1, end: 2 })).unwrap();
        out.enqueue(&alert()).unwrap();
        let order: Vec<_> = std::iter::from_fn(|| out.next_frame()).map(kind_of).collect();
        assert_eq!(order, ["event", "contact", "tile"]);
    }

    #[test]
    fn full_size_tile_fits_in_a_frame() {
        let data: Vec<u8> = (0..4096u32).map(|i| (i % 251) as u8).collect();
        let mut out: Outbox<1> = Outbox::new();
        out.enqueue(&tile(&data)).unwrap();
        let frame = out.next_frame().unwrap();
        assert!(frame.len() <= MAX_FRAME);
    }

    #[test]
    fn oversized_tile_is_an_encode_error() {
        let data = vec![1u8; MAX_FRAME];
        let mut out: Outbox<1> = Outbox::new();
        assert!(matches!(out.enqueue(&tile(&data)), Err(EnqueueError::Encode(_))));
        assert!(out.is_empty());
    }

    #[test]
    fn alert_evicts_tile_when_full_and_report_says_so() {
        let mut out: Outbox<1> = Outbox::new();
        assert_eq!(out.enqueue(&tile(&[1, 2, 3])), Ok(false));
        assert_eq!(out.enqueue(&alert()), Ok(true));
        assert_eq!(kind_of(out.next_frame().unwrap()), "event");
        assert_eq!(out.next_frame(), None);
    }

    #[test]
    fn tile_is_rejected_when_queue_holds_only_alerts() {
        let mut out: Outbox<1> = Outbox::new();
        out.enqueue(&alert()).unwrap();
        assert_eq!(out.enqueue(&tile(&[1])), Err(EnqueueError::Full));
        let poi = Message::Poi(PoiUpdate {
            id: 1,
            version: 1,
            kind: PoiKind::Hazard,
            pos: CellPos { tile: TileId { x: 0, y: 0 }, cx: 0, cy: 0 },
            active: true,
        });
        assert_eq!(out.enqueue(&poi), Err(EnqueueError::Full));
    }

    fn contact_msg() -> Message<'static> {
        Message::Contact(ContactWindow { start: 0, end: 1 })
    }

    #[test]
    fn nothing_leaves_without_a_window_or_outside_it() {
        let mut out: Outbox<4> = Outbox::new();
        out.enqueue(&alert()).unwrap();
        let mut tx = Transmitter::new(1000);
        assert_eq!(tx.poll(&mut out, 5), None);
        tx.set_window(ContactWindow { start: 10, end: 20 });
        assert_eq!(tx.poll(&mut out, 9), None);
        assert_eq!(tx.poll(&mut out, 20), None);
        assert_eq!(out.len(), 1);
        assert!(tx.poll(&mut out, 10).is_some());
    }

    #[test]
    fn inverted_window_is_no_window() {
        let mut out: Outbox<4> = Outbox::new();
        out.enqueue(&alert()).unwrap();
        let mut tx = Transmitter::new(1000);
        tx.set_window(ContactWindow { start: 20, end: 10 });
        assert_eq!(tx.poll(&mut out, 15), None);
    }

    #[test]
    fn budget_limits_bytes_per_window_and_resets_on_new_window() {
        let mut out: Outbox<8> = Outbox::new();
        for _ in 0..3 {
            out.enqueue(&alert()).unwrap();
        }
        let len = out.peek_len().unwrap() as u32;
        // Budget for exactly two alerts in a 1 s window.
        let mut tx = Transmitter::new(len * 2);
        tx.set_window(ContactWindow { start: 0, end: 1 });
        assert!(tx.poll(&mut out, 0).is_some());
        assert!(tx.poll(&mut out, 0).is_some());
        assert_eq!(tx.poll(&mut out, 0), None);
        assert_eq!(out.len(), 1);
        tx.set_window(ContactWindow { start: 100, end: 101 });
        assert!(tx.poll(&mut out, 100).is_some());
    }

    #[test]
    fn urgent_frame_that_does_not_fit_blocks_less_urgent_ones() {
        let mut out: Outbox<8> = Outbox::new();
        out.enqueue(&alert()).unwrap();
        out.enqueue(&tile(&[1])).unwrap();
        let alert_len = out.peek_len().unwrap() as u32;
        // Fits the alert once; leftover is smaller than the alert.
        let mut tx = Transmitter::new(alert_len + alert_len / 2);
        tx.set_window(ContactWindow { start: 0, end: 1 });
        out.enqueue(&alert()).unwrap();
        assert_eq!(kind_of(tx.poll(&mut out, 0).unwrap()), "event");
        // Second alert no longer fits; the small tile must NOT jump ahead.
        assert_eq!(tx.poll(&mut out, 0), None);
        assert_eq!(out.len(), 2);
    }

    #[test]
    fn frame_larger_than_whole_window_is_dropped_not_blocking() {
        let big = vec![1u8; 4096];
        let mut out: Outbox<4> = Outbox::new();
        out.enqueue(&tile(&big)).unwrap();
        out.enqueue(&contact_msg()).unwrap();
        let mut tx = Transmitter::new(100); // 100 B window capacity
        tx.set_window(ContactWindow { start: 0, end: 1 });
        // Contact leaves first; then the oversize tile is discarded.
        assert_eq!(kind_of(tx.poll(&mut out, 0).unwrap()), "contact");
        assert_eq!(tx.poll(&mut out, 0), None);
        assert_eq!(tx.dropped_oversize, 1);
        assert!(out.is_empty());
    }
}
