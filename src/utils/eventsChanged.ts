// Lets an undo that finishes after the user navigated away refresh whichever
// event list is on screen.
type Listener = () => void;

const listeners = new Set<Listener>();

export const onEventsChanged = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifyEventsChanged = () => {
  listeners.forEach((listener) => listener());
};
