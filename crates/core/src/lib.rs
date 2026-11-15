//! Shared layer data model. `no_std` so the same types run on the glove MCU.
#![cfg_attr(not(test), no_std)]

pub mod frame;
pub mod queue;

use serde::{Deserialize, Serialize};

/// Tile side in cells.
pub const TILE_SIDE: usize = 64;
/// Cell size in meters (assumption: derived from the 200 m MOLA/HRSC DEM).
pub const CELL_METERS: u16 = 100;

/// Link priority classes. Lower value is sent first.
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum Priority {
    /// Solar events.
    Alert = 0,
    /// POI and contact window changes.
    Route = 1,
    /// Base layer tiles, including traverse-cost tiles (`LayerId::TraverseCost`).
    Base = 2,
}

#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum LayerId {
    Elevation = 0,
    Slope = 1,
    Roughness = 2,
    TraverseCost = 3,
    RadBase = 4,
    ShelterFactor = 5,
    ShelterRoute = 6,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TileId {
    pub x: i16,
    pub y: i16,
}

/// Header of a synced tile. `version` is monotonic per (layer, tile).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct TileHeader {
    pub layer: LayerId,
    pub id: TileId,
    pub version: u32,
}

#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum EventKind {
    Flare = 0,
    Cme = 1,
    Sep = 2,
}

#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum EventStatus {
    Forecast = 0,
    Active = 1,
    Ended = 2,
}

/// Solar event pushed from Earth. Times are UTC seconds.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct SolarEvent {
    pub id: u32,
    pub kind: EventKind,
    pub issued_at: u64,
    pub arrival_start: u64,
    pub arrival_end: u64,
    /// 0..=3
    pub severity: u8,
    pub dose_multiplier: f32,
    /// 0..=100
    pub confidence: u8,
    pub status: EventStatus,
    /// 0 means it supersedes nothing.
    pub supersedes: u32,
}

/// Point of interest category (assumption: set to refine with the crew).
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub enum PoiKind {
    Habitat = 0,
    Shelter = 1,
    Science = 2,
    Hazard = 3,
}

/// Position inside a tile, in cells (`0..TILE_SIDE`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CellPos {
    pub tile: TileId,
    pub cx: u8,
    pub cy: u8,
}

/// Add/replace (`active = true`) or remove a POI. Higher `version` wins.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PoiUpdate {
    pub id: u16,
    pub version: u32,
    pub kind: PoiKind,
    pub pos: CellPos,
    pub active: bool,
}

/// Next window in which the relay can talk to the surface. UTC seconds.
/// Traverse cost changes travel as `LayerId::TraverseCost` tiles instead.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContactWindow {
    pub start: u64,
    pub end: u64,
}

impl Priority {
    pub const fn for_event() -> Self {
        Priority::Alert
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alert_goes_before_route_before_base() {
        assert!(Priority::Alert < Priority::Route);
        assert!(Priority::Route < Priority::Base);
        assert_eq!(Priority::for_event(), Priority::Alert);
    }

    #[test]
    fn solar_event_roundtrips_through_postcard() {
        let ev = SolarEvent {
            id: 7,
            kind: EventKind::Cme,
            issued_at: 1_000,
            arrival_start: 2_000,
            arrival_end: 3_000,
            severity: 3,
            dose_multiplier: 2.5,
            confidence: 80,
            status: EventStatus::Active,
            supersedes: 0,
        };
        let mut buf = [0u8; 64];
        let bytes = postcard::to_slice(&ev, &mut buf).unwrap();
        assert!(bytes.len() <= 32, "alert must stay tiny, got {}", bytes.len());
        let back: SolarEvent = postcard::from_bytes(bytes).unwrap();
        assert_eq!(back, ev);
    }

    #[test]
    fn tile_header_roundtrips_through_postcard() {
        let h = TileHeader {
            layer: LayerId::RadBase,
            id: TileId { x: -3, y: 12 },
            version: 42,
        };
        let mut buf = [0u8; 16];
        let bytes = postcard::to_slice(&h, &mut buf).unwrap();
        let back: TileHeader = postcard::from_bytes(bytes).unwrap();
        assert_eq!(back, h);
    }

    #[test]
    fn u8_tile_is_4kb() {
        assert_eq!(TILE_SIDE * TILE_SIDE, 4096);
    }
}
