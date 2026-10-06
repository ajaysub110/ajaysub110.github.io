export function fixedBoundaries(duration, size) {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(size) || size <= 0) throw new Error('Invalid segment duration');
  const result = [0];
  for (let t = size; t < duration - 0.001; t += size) result.push(t);
  result.push(duration);
  return result;
}
export function segmentAt(boundaries, time) {
  const endIndex = boundaries.findIndex((end, i) => i > 0 && time < end);
  return endIndex === -1 ? boundaries.length - 2 : endIndex - 1;
}
export function editBoundary(boundaries, index, time) {
  if (index <= 0 || index >= boundaries.length - 1 || !Number.isFinite(time) || time <= boundaries[index-1] + 0.1 || time >= boundaries[index+1] - 0.1) throw new Error('Leave at least 0.1 seconds between boundaries.');
  return boundaries.map((t,i) => i === index ? time : t);
}
export function addBoundary(boundaries, time) {
  if (!Number.isFinite(time) || boundaries.some(t => Math.abs(t-time) <= 0.1) || time < 0 || time > boundaries.at(-1)) throw new Error('Choose a point at least 0.1 seconds from another boundary.');
  return [...boundaries,time].sort((a,b) => a-b);
}
export class Countdown {
  constructor(schedule = (callback, milliseconds) => setTimeout(callback, milliseconds), unschedule = id => clearTimeout(id)) {this.schedule = schedule; this.unschedule = unschedule; this.generation = 0; this.id = null;}
  cancel() {this.generation++; if (this.id !== null) this.unschedule(this.id); this.id = null;}
  start(seconds, callback) {this.cancel(); const generation = this.generation; this.id = this.schedule(() => {if (generation === this.generation) {this.id = null; callback();}}, seconds * 1000);}
}
