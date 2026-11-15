//! Link framing: a `Message` is postcard-encoded then COBS-framed, so every
//! frame ends in a single 0x00 delimiter and a receiver can resync after loss.

use crate::{ContactWindow, PoiUpdate, Priority, SolarEvent, TileHeader};
use serde::{Deserialize, Serialize};

use postcard::ser_flavors::{crc::CrcModifier, Cobs, Slice};

pub use postcard::Error;

type Crc32Cobs<'a, 'b> = CrcModifier<'a, Cobs<Slice<'b>>, u32>;

/// Everything that travels over the satellite -> hub -> glove link.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub enum Message<'a> {
    Event(SolarEvent),
    Poi(PoiUpdate),
    Contact(ContactWindow),
    Tile { header: TileHeader, data: &'a [u8] },
}

impl Message<'_> {
    /// Class used by the sender to order the outgoing queue.
    pub const fn priority(&self) -> Priority {
        match self {
            Message::Event(_) => Priority::Alert,
            Message::Poi(_) | Message::Contact(_) => Priority::Route,
            Message::Tile { .. } => Priority::Base,
        }
    }
}

/// CRC-32/ISCSI (Castagnoli): better burst-error detection than CRC-32/ISO-HDLC
/// for short frames.
static CRC: crc::Crc<u32> = crc::Crc::<u32>::new(&crc::CRC_32_ISCSI);

/// Encodes `msg` into `buf` as one frame: postcard payload, CRC-32 (LE), COBS,
/// trailing 0x00. Returns the used prefix of `buf`.
pub fn encode<'b>(msg: &Message<'_>, buf: &'b mut [u8]) -> Result<&'b mut [u8], Error> {
    let flavor = Crc32Cobs::new(Cobs::try_new(Slice::new(buf))?, CRC.digest());
    postcard::serialize_with_flavor(msg, flavor)
}

/// Decodes one frame (with or without its trailing 0x00), rejecting it if the
/// CRC does not match. `frame` is used as scratch space, so the decoded message
/// borrows from it.
pub fn decode(frame: &mut [u8]) -> Result<Message<'_>, Error> {
    let len = cobs::decode_in_place(frame).map_err(|_| Error::DeserializeBadEncoding)?;
    postcard::from_bytes_crc32(&frame[..len], CRC.digest())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{CellPos, EventKind, EventStatus, LayerId, PoiKind, TileId};

    fn event() -> SolarEvent {
        SolarEvent {
            id: 1,
            kind: EventKind::Flare,
            issued_at: 10,
            arrival_start: 20,
            arrival_end: 30,
            severity: 2,
            dose_multiplier: 1.5,
            confidence: 90,
            status: EventStatus::Forecast,
            supersedes: 0,
        }
    }

    #[test]
    fn event_frame_roundtrips_and_ends_with_delimiter() {
        let msg = Message::Event(event());
        let mut buf = [0u8; 64];
        let frame = encode(&msg, &mut buf).unwrap();
        assert_eq!(*frame.last().unwrap(), 0);
        assert_eq!(frame.iter().filter(|b| **b == 0).count(), 1);
        let mut copy = [0u8; 64];
        let n = frame.len();
        copy[..n].copy_from_slice(frame);
        assert_eq!(decode(&mut copy[..n]).unwrap(), msg);
    }

    #[test]
    fn tile_frame_roundtrips() {
        let data = [7u8; 100];
        let msg = Message::Tile {
            header: TileHeader { layer: LayerId::Elevation, id: TileId { x: 1, y: -1 }, version: 3 },
            data: &data,
        };
        let mut buf = [0u8; 256];
        let frame = encode(&msg, &mut buf).unwrap();
        let n = frame.len();
        let mut copy = [0u8; 256];
        copy[..n].copy_from_slice(frame);
        assert_eq!(decode(&mut copy[..n]).unwrap(), msg);
    }

    fn roundtrip(msg: Message<'_>) -> usize {
        let mut buf = [0u8; 64];
        let frame = encode(&msg, &mut buf).unwrap();
        let n = frame.len();
        let mut copy = [0u8; 64];
        copy[..n].copy_from_slice(frame);
        assert_eq!(decode(&mut copy[..n]).unwrap(), msg);
        n
    }

    #[test]
    fn route_messages_roundtrip_and_stay_small() {
        let poi = Message::Poi(PoiUpdate {
            id: 12,
            version: 3,
            kind: PoiKind::Shelter,
            pos: CellPos { tile: TileId { x: -2, y: 5 }, cx: 63, cy: 0 },
            active: true,
        });
        let contact = Message::Contact(ContactWindow { start: 1_000, end: 1_600 });
        assert!(roundtrip(poi) <= 24);
        assert!(roundtrip(contact) <= 24);
    }

    #[test]
    fn route_messages_have_route_priority() {
        let poi = Message::Poi(PoiUpdate {
            id: 1,
            version: 1,
            kind: PoiKind::Hazard,
            pos: CellPos { tile: TileId { x: 0, y: 0 }, cx: 0, cy: 0 },
            active: false,
        });
        assert_eq!(poi.priority(), Priority::Route);
        assert_eq!(Message::Contact(ContactWindow { start: 0, end: 1 }).priority(), Priority::Route);
    }

    #[test]
    fn priority_follows_message_kind() {
        assert_eq!(Message::Event(event()).priority(), Priority::Alert);
        let t = Message::Tile {
            header: TileHeader { layer: LayerId::Slope, id: TileId { x: 0, y: 0 }, version: 1 },
            data: &[],
        };
        assert_eq!(t.priority(), Priority::Base);
    }

    #[test]
    fn corrupted_frame_is_rejected_not_misread() {
        let mut buf = [0u8; 64];
        let frame = encode(&Message::Event(event()), &mut buf).unwrap();
        let n = frame.len();
        let mut bad = [0u8; 64];
        bad[..n].copy_from_slice(frame);
        bad[0] = 0xFF; // bogus COBS code byte
        assert!(decode(&mut bad[..n]).is_err());
    }

    #[test]
    fn flipped_payload_byte_fails_crc() {
        let mut buf = [0u8; 64];
        let frame = encode(&Message::Event(event()), &mut buf).unwrap();
        let n = frame.len();
        // Flip one bit in every non-delimiter, non-code position: none may decode.
        for i in 1..n - 1 {
            let mut bad = [0u8; 64];
            bad[..n].copy_from_slice(frame);
            bad[i] ^= 0x01;
            if bad[i] == 0 {
                continue; // would split the frame; covered by truncation
            }
            assert!(decode(&mut bad[..n]).is_err(), "flip at {i} was accepted");
        }
    }

    #[test]
    fn truncated_frame_is_rejected() {
        let mut buf = [0u8; 64];
        let frame = encode(&Message::Event(event()), &mut buf).unwrap();
        let n = frame.len();
        let mut cut = [0u8; 64];
        cut[..n - 3].copy_from_slice(&frame[..n - 3]);
        assert!(decode(&mut cut[..n - 3]).is_err());
    }

    #[test]
    fn too_small_buffer_errors() {
        let mut buf = [0u8; 4];
        assert!(encode(&Message::Event(event()), &mut buf).is_err());
    }
}
