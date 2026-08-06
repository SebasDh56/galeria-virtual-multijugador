const ZONES = Object.freeze({
  LOBBY: "lobby",
  CORRIDOR: "corridor",
  MAIN_ROOM: "main-room"
});

const TRANSITION_DISTANCE = 4;
const LOBBY_BOUNDARY_Z = 9;
const MAIN_ROOM_BOUNDARY_Z = -9;

function resolveGalleryZone(position = {}) {
  const z = Number(position.z);

  if (z >= LOBBY_BOUNDARY_Z) {
    return ZONES.LOBBY;
  }

  if (z <= MAIN_ROOM_BOUNDARY_Z) {
    return ZONES.MAIN_ROOM;
  }

  return ZONES.CORRIDOR;
}

function resolveInterestZones(position = {}) {
  const z = Number(position.z);
  const currentZone = resolveGalleryZone(position);
  const zones = new Set([currentZone]);

  if (
    currentZone === ZONES.LOBBY &&
    z <= LOBBY_BOUNDARY_Z + TRANSITION_DISTANCE
  ) {
    zones.add(ZONES.CORRIDOR);
  }

  if (currentZone === ZONES.CORRIDOR) {
    if (z >= LOBBY_BOUNDARY_Z - TRANSITION_DISTANCE) {
      zones.add(ZONES.LOBBY);
    }

    if (z <= MAIN_ROOM_BOUNDARY_Z + TRANSITION_DISTANCE) {
      zones.add(ZONES.MAIN_ROOM);
    }
  }

  if (
    currentZone === ZONES.MAIN_ROOM &&
    z >= MAIN_ROOM_BOUNDARY_Z - TRANSITION_DISTANCE
  ) {
    zones.add(ZONES.CORRIDOR);
  }

  return zones;
}

function haveSameZones(firstZones, secondZones) {
  if (firstZones.size !== secondZones.size) {
    return false;
  }

  for (const zone of firstZones) {
    if (!secondZones.has(zone)) {
      return false;
    }
  }

  return true;
}

function getInterestRoom(zone) {
  return `interest:${zone}`;
}

module.exports = {
  ZONES,
  getInterestRoom,
  haveSameZones,
  resolveGalleryZone,
  resolveInterestZones
};
