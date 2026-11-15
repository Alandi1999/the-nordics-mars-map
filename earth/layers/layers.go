// Package layers mirrors the Rust nasamars-core data model on the Earth side.
package layers

const (
	TileSide   = 64
	CellMeters = 100
)

// Priority classes. Lower value is sent first.
type Priority uint8

const (
	PriorityAlert Priority = iota // solar events
	PriorityRoute                 // POI, traverse cost, contact windows
	PriorityBase                  // base layer deltas
)

type LayerID uint8

const (
	Elevation LayerID = iota
	Slope
	Roughness
	TraverseCost
	RadBase
	ShelterFactor
	ShelterRoute
)

type TileID struct{ X, Y int16 }

type TileHeader struct {
	Layer   LayerID
	ID      TileID
	Version uint32
}
