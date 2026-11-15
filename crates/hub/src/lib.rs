//! Suit/rover hub state: receives frames from the satellite, keeps only the
//! newest version of each item, and forwards alerts and route updates to the
//! glove queue. Tile forwarding to the glove is not decided yet (the glove
//! needs a tile-selection policy first), so tiles are only cached.

use std::collections::{HashMap, HashSet};

use nasamars_core::frame::{self, Error, Message};
use nasamars_core::{ContactWindow, PoiUpdate, SolarEvent};
use nasamars_link::Outbox;

/// Why a frame changed (or did not change) hub state.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    /// New information; state updated.
    Applied,
    /// Same version already held.
    Duplicate,
    /// Older than what the hub holds (or explicitly superseded).
    Stale,
}

#[derive(Default, Debug, PartialEq, Eq)]
pub struct Stats {
    pub applied: u32,
    pub duplicate: u32,
    pub stale: u32,
    /// Frames rejected by COBS/CRC/format checks.
    pub corrupt: u32,
    /// Accepted items that could not be queued for the glove.
    pub glove_dropped: u32,
}

pub struct Hub<const N: usize> {
    tiles: HashMap<(u8, i16, i16), (u32, Vec<u8>)>,
    pois: HashMap<u16, PoiUpdate>,
    events: HashMap<u32, SolarEvent>,
    superseded: HashSet<u32>,
    contact: Option<ContactWindow>,
    pub glove: Outbox<N>,
    pub stats: Stats,
}

impl<const N: usize> Hub<N> {
    pub fn new() -> Self {
        Self {
            tiles: HashMap::new(),
            pois: HashMap::new(),
            events: HashMap::new(),
            superseded: HashSet::new(),
            contact: None,
            glove: Outbox::new(),
            stats: Stats::default(),
        }
    }

    pub fn contact(&self) -> Option<ContactWindow> {
        self.contact
    }

    pub fn event(&self, id: u32) -> Option<&SolarEvent> {
        self.events.get(&id)
    }

    pub fn poi(&self, id: u16) -> Option<&PoiUpdate> {
        self.pois.get(&id)
    }

    pub fn tile(&self, layer: nasamars_core::LayerId, x: i16, y: i16) -> Option<(u32, &[u8])> {
        self.tiles.get(&(layer as u8, x, y)).map(|(v, d)| (*v, d.as_slice()))
    }

    /// Handles one frame from the satellite. `frame` is used as scratch.
    pub fn receive(&mut self, frame: &mut [u8]) -> Result<Outcome, Error> {
        let msg = match frame::decode(frame) {
            Ok(m) => m,
            Err(e) => {
                self.stats.corrupt += 1;
                return Err(e);
            }
        };
        let outcome = self.apply(&msg);
        match outcome {
            Outcome::Applied => {
                self.stats.applied += 1;
                if !matches!(msg, Message::Tile { .. }) && self.glove.enqueue(&msg).is_err() {
                    self.stats.glove_dropped += 1;
                }
            }
            Outcome::Duplicate => self.stats.duplicate += 1,
            Outcome::Stale => self.stats.stale += 1,
        }
        Ok(outcome)
    }

    fn apply(&mut self, msg: &Message<'_>) -> Outcome {
        match msg {
            Message::Tile { header, data } => {
                let key = (header.layer as u8, header.id.x, header.id.y);
                match self.tiles.get(&key) {
                    Some((v, _)) if header.version == *v => Outcome::Duplicate,
                    Some((v, _)) if header.version < *v => Outcome::Stale,
                    _ => {
                        self.tiles.insert(key, (header.version, data.to_vec()));
                        Outcome::Applied
                    }
                }
            }
            Message::Poi(p) => match self.pois.get(&p.id) {
                Some(old) if p.version == old.version => Outcome::Duplicate,
                Some(old) if p.version < old.version => Outcome::Stale,
                // Removals are kept as tombstones so an older add cannot resurrect a POI.
                _ => {
                    self.pois.insert(p.id, *p);
                    Outcome::Applied
                }
            },
            Message::Event(e) => {
                if self.superseded.contains(&e.id) {
                    return Outcome::Stale;
                }
                match self.events.get(&e.id) {
                    Some(old) if e.issued_at == old.issued_at => return Outcome::Duplicate,
                    Some(old) if e.issued_at < old.issued_at => return Outcome::Stale,
                    _ => {}
                }
                if e.supersedes != 0 {
                    self.events.remove(&e.supersedes);
                    self.superseded.insert(e.supersedes);
                }
                self.events.insert(e.id, *e);
                Outcome::Applied
            }
            Message::Contact(w) => {
                if self.contact == Some(*w) {
                    Outcome::Duplicate
                } else {
                    self.contact = Some(*w);
                    Outcome::Applied
                }
            }
        }
    }
}

impl<const N: usize> Default for Hub<N> {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use nasamars_core::{CellPos, EventKind, EventStatus, LayerId, PoiKind, TileHeader, TileId};

    fn send<const N: usize>(hub: &mut Hub<N>, msg: &Message<'_>) -> Result<Outcome, Error> {
        let mut buf = vec![0u8; nasamars_link::MAX_FRAME];
        let n = frame::encode(msg, &mut buf).unwrap().len();
        hub.receive(&mut buf[..n])
    }

    fn event(id: u32, issued_at: u64, supersedes: u32) -> SolarEvent {
        SolarEvent {
            id,
            kind: EventKind::Flare,
            issued_at,
            arrival_start: 10,
            arrival_end: 20,
            severity: 2,
            dose_multiplier: 2.0,
            confidence: 80,
            status: EventStatus::Forecast,
            supersedes,
        }
    }

    fn poi(id: u16, version: u32, active: bool) -> PoiUpdate {
        PoiUpdate {
            id,
            version,
            kind: PoiKind::Shelter,
            pos: CellPos { tile: TileId { x: 0, y: 0 }, cx: 1, cy: 1 },
            active,
        }
    }

    fn tile(version: u32, data: &[u8]) -> Message<'_> {
        Message::Tile {
            header: TileHeader { layer: LayerId::Slope, id: TileId { x: 1, y: 2 }, version },
            data,
        }
    }

    #[test]
    fn tile_newer_wins_duplicate_and_older_are_ignored() {
        let mut hub: Hub<8> = Hub::new();
        assert_eq!(send(&mut hub, &tile(2, &[2])), Ok(Outcome::Applied));
        assert_eq!(send(&mut hub, &tile(2, &[9])), Ok(Outcome::Duplicate));
        assert_eq!(send(&mut hub, &tile(1, &[1])), Ok(Outcome::Stale));
        assert_eq!(hub.tile(LayerId::Slope, 1, 2), Some((2, &[2u8][..])));
        assert_eq!(send(&mut hub, &tile(3, &[3])), Ok(Outcome::Applied));
        assert_eq!(hub.tile(LayerId::Slope, 1, 2), Some((3, &[3u8][..])));
    }

    #[test]
    fn removed_poi_is_not_resurrected_by_an_older_add() {
        let mut hub: Hub<8> = Hub::new();
        assert_eq!(send(&mut hub, &Message::Poi(poi(5, 1, true))), Ok(Outcome::Applied));
        assert_eq!(send(&mut hub, &Message::Poi(poi(5, 3, false))), Ok(Outcome::Applied));
        assert_eq!(send(&mut hub, &Message::Poi(poi(5, 2, true))), Ok(Outcome::Stale));
        assert!(!hub.poi(5).unwrap().active);
    }

    #[test]
    fn event_update_duplicate_and_stale_by_issue_time() {
        let mut hub: Hub<8> = Hub::new();
        assert_eq!(send(&mut hub, &Message::Event(event(1, 100, 0))), Ok(Outcome::Applied));
        assert_eq!(send(&mut hub, &Message::Event(event(1, 100, 0))), Ok(Outcome::Duplicate));
        assert_eq!(send(&mut hub, &Message::Event(event(1, 50, 0))), Ok(Outcome::Stale));
        assert_eq!(send(&mut hub, &Message::Event(event(1, 200, 0))), Ok(Outcome::Applied));
        assert_eq!(hub.event(1).unwrap().issued_at, 200);
    }

    #[test]
    fn superseding_event_removes_old_and_blocks_its_replay() {
        let mut hub: Hub<8> = Hub::new();
        send(&mut hub, &Message::Event(event(1, 100, 0))).unwrap();
        assert_eq!(send(&mut hub, &Message::Event(event(2, 150, 1))), Ok(Outcome::Applied));
        assert!(hub.event(1).is_none());
        assert_eq!(send(&mut hub, &Message::Event(event(1, 100, 0))), Ok(Outcome::Stale));
        assert!(hub.event(1).is_none());
    }

    #[test]
    fn only_applied_alerts_and_routes_reach_the_glove_queue() {
        let mut hub: Hub<8> = Hub::new();
        send(&mut hub, &Message::Event(event(1, 100, 0))).unwrap();
        send(&mut hub, &Message::Event(event(1, 100, 0))).unwrap(); // duplicate
        send(&mut hub, &Message::Contact(ContactWindow { start: 1, end: 2 })).unwrap();
        send(&mut hub, &tile(1, &[1])).unwrap(); // cached only
        assert_eq!(hub.glove.len(), 2);
        assert_eq!(hub.contact(), Some(ContactWindow { start: 1, end: 2 }));
        assert_eq!(hub.stats.applied, 3);
        assert_eq!(hub.stats.duplicate, 1);
    }

    #[test]
    fn corrupt_frame_changes_nothing_and_is_counted() {
        let mut hub: Hub<8> = Hub::new();
        let mut buf = vec![0u8; 64];
        let n = frame::encode(&Message::Event(event(1, 1, 0)), &mut buf).unwrap().len();
        buf[n / 2] ^= 0x01;
        if buf[n / 2] == 0 {
            buf[n / 2] = 2;
        }
        assert!(hub.receive(&mut buf[..n]).is_err());
        assert!(hub.event(1).is_none());
        assert_eq!(hub.stats.corrupt, 1);
        assert!(hub.glove.is_empty());
    }

    #[test]
    fn full_glove_queue_is_counted_but_state_still_updates() {
        let mut hub: Hub<1> = Hub::new();
        send(&mut hub, &Message::Event(event(1, 100, 0))).unwrap();
        assert_eq!(send(&mut hub, &Message::Event(event(2, 100, 0))), Ok(Outcome::Applied));
        assert!(hub.event(2).is_some());
        assert_eq!(hub.stats.glove_dropped, 1);
    }
}
