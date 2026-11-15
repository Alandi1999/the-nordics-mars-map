//! Fixed-capacity outbound queue ordered by `Priority`, FIFO within a class.
//! No allocation, so it runs on the satellite, the hub and the glove MCU.
//!
//! When full, a more urgent item evicts the oldest item of the least urgent
//! class (stale base data is worth less than a fresh alert). An item that is
//! not more urgent than everything queued is rejected instead.

use crate::Priority;

pub struct PriorityQueue<T, const N: usize> {
    slots: [Option<(Priority, u64, T)>; N],
    next_seq: u64,
}

impl<T, const N: usize> PriorityQueue<T, N> {
    pub const fn new() -> Self {
        Self { slots: [const { None }; N], next_seq: 0 }
    }

    pub fn len(&self) -> usize {
        self.slots.iter().filter(|s| s.is_some()).count()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Queues `item`. `Ok(Some(old))` means `old` was evicted to make room;
    /// `Err(item)` means the queue is full of items at least as urgent.
    pub fn push(&mut self, priority: Priority, item: T) -> Result<Option<T>, T> {
        let seq = self.next_seq;
        let mut evicted = None;
        let idx = match self.slots.iter().position(|s| s.is_none()) {
            Some(i) => i,
            None => {
                // Least urgent class first, oldest within it.
                let worst = self
                    .slots
                    .iter()
                    .enumerate()
                    .filter_map(|(i, s)| s.as_ref().map(|(p, q, _)| (i, *p, *q)))
                    .max_by_key(|&(_, p, q)| (p, core::cmp::Reverse(q)));
                match worst {
                    Some((i, p, _)) if p > priority => {
                        evicted = self.slots[i].take().map(|(_, _, t)| t);
                        i
                    }
                    _ => return Err(item),
                }
            }
        };
        self.slots[idx] = Some((priority, seq, item));
        self.next_seq += 1;
        Ok(evicted)
    }

    /// The item `pop` would return, without removing it.
    pub fn peek(&self) -> Option<&T> {
        self.slots
            .iter()
            .filter_map(|s| s.as_ref())
            .min_by_key(|(p, q, _)| (*p, *q))
            .map(|(_, _, t)| t)
    }

    /// Removes the most urgent item (oldest first within a class).
    pub fn pop(&mut self) -> Option<T> {
        let best = self
            .slots
            .iter()
            .enumerate()
            .filter_map(|(i, s)| s.as_ref().map(|(p, q, _)| (i, *p, *q)))
            .min_by_key(|&(_, p, q)| (p, q))?;
        self.slots[best.0].take().map(|(_, _, t)| t)
    }
}

impl<T, const N: usize> Default for PriorityQueue<T, N> {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use Priority::*;

    #[test]
    fn pops_most_urgent_first_then_fifo() {
        let mut q: PriorityQueue<&str, 8> = PriorityQueue::new();
        q.push(Base, "b1").unwrap();
        q.push(Route, "r1").unwrap();
        q.push(Alert, "a1").unwrap();
        q.push(Base, "b2").unwrap();
        q.push(Alert, "a2").unwrap();
        let order: [&str; 5] = core::array::from_fn(|_| q.pop().unwrap());
        assert_eq!(order, ["a1", "a2", "r1", "b1", "b2"]);
        assert!(q.is_empty());
        assert_eq!(q.pop(), None);
    }

    #[test]
    fn alert_evicts_oldest_base_when_full() {
        let mut q: PriorityQueue<&str, 3> = PriorityQueue::new();
        q.push(Base, "b1").unwrap();
        q.push(Route, "r1").unwrap();
        q.push(Base, "b2").unwrap();
        assert_eq!(q.push(Alert, "a1"), Ok(Some("b1")));
        assert_eq!(q.len(), 3);
        assert_eq!(q.pop(), Some("a1"));
        assert_eq!(q.pop(), Some("r1"));
        assert_eq!(q.pop(), Some("b2"));
    }

    #[test]
    fn rejects_item_not_more_urgent_than_queued() {
        let mut q: PriorityQueue<&str, 2> = PriorityQueue::new();
        q.push(Alert, "a1").unwrap();
        q.push(Alert, "a2").unwrap();
        assert_eq!(q.push(Alert, "a3"), Err("a3"));
        assert_eq!(q.push(Base, "b1"), Err("b1"));
        assert_eq!(q.pop(), Some("a1"));
        assert_eq!(q.pop(), Some("a2"));
    }

    #[test]
    fn peek_matches_pop_without_removing() {
        let mut q: PriorityQueue<&str, 4> = PriorityQueue::new();
        assert_eq!(q.peek(), None);
        q.push(Base, "b").unwrap();
        q.push(Alert, "a").unwrap();
        assert_eq!(q.peek(), Some(&"a"));
        assert_eq!(q.len(), 2);
        assert_eq!(q.pop(), Some("a"));
        assert_eq!(q.peek(), Some(&"b"));
    }

    #[test]
    fn slot_freed_by_pop_is_reused_and_order_holds() {
        let mut q: PriorityQueue<u8, 2> = PriorityQueue::new();
        q.push(Base, 1).unwrap();
        q.push(Base, 2).unwrap();
        assert_eq!(q.pop(), Some(1));
        q.push(Base, 3).unwrap();
        assert_eq!(q.pop(), Some(2));
        assert_eq!(q.pop(), Some(3));
    }
}
