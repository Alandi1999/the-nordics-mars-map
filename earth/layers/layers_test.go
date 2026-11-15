package layers

import "testing"

func TestPriorityOrder(t *testing.T) {
	if !(PriorityAlert < PriorityRoute && PriorityRoute < PriorityBase) {
		t.Fatal("alert must go before route before base")
	}
}

func TestU8TileIs4KB(t *testing.T) {
	if TileSide*TileSide != 4096 {
		t.Fatalf("got %d", TileSide*TileSide)
	}
}
