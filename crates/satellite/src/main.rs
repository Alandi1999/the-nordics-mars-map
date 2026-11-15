//! Demo of the satellite outbound path: enqueues sample messages and prints the frame sizes in
//! send order. A layer replica and delta distribution are not implemented yet.
use nasamars_core::frame::Message;
use nasamars_core::{ContactWindow, EventKind, EventStatus, LayerId, SolarEvent, TileHeader, TileId};
use nasamars_link::{Outbox, Transmitter};

fn main() {
    println!(
        "nasamars-satellite: tile {}x{} cells at {} m",
        nasamars_core::TILE_SIDE,
        nasamars_core::TILE_SIDE,
        nasamars_core::CELL_METERS
    );

    // Demo: whatever is enqueued first, the alert leaves the antenna first.
    let tile_data = vec![0u8; nasamars_core::TILE_SIDE * nasamars_core::TILE_SIDE];
    let mut out: Outbox<16> = Outbox::new();
    out.enqueue(&Message::Tile {
        header: TileHeader { layer: LayerId::Elevation, id: TileId { x: 0, y: 0 }, version: 1 },
        data: &tile_data,
    })
    .expect("tile");
    out.enqueue(&Message::Contact(ContactWindow { start: 0, end: 600 })).expect("contact");
    out.enqueue(&Message::Event(SolarEvent {
        id: 1,
        kind: EventKind::Flare,
        issued_at: 0,
        arrival_start: 60,
        arrival_end: 600,
        severity: 2,
        dose_multiplier: 2.0,
        confidence: 80,
        status: EventStatus::Forecast,
        supersedes: 0,
    }))
    .expect("event");
    // Demo link: 10 s window at 500 B/s = 5000 B budget.
    let mut tx = Transmitter::new(500);
    tx.set_window(ContactWindow { start: 0, end: 10 });
    while let Some(frame) = tx.poll(&mut out, 0) {
        println!("tx frame: {} bytes", frame.len());
    }
    println!("left queued: {}, dropped oversize: {}", out.len(), tx.dropped_oversize);
}
