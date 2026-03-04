export interface Position {
  x: number;
  y: number;
}

export interface Performer {
  id: string;
  name: string;
  color: string;
}

export interface Formation {
  id: string;
  name: string;
  positions: Record<string, Position>; // performerId -> Position
}

export interface Project {
  id: string;
  name: string;
  performers: Performer[];
  formations: Formation[];
  settings: {
    fps: number;
    transitionDuration: number; // in seconds
    easing: string;
  };
}
