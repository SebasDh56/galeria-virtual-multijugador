const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ZONES,
  haveSameZones,
  resolveGalleryZone,
  resolveInterestZones
} = require("../server/multiplayer-zones");

test("clasifica las tres áreas de la galería", () => {
  assert.equal(resolveGalleryZone({ z: 16 }), ZONES.LOBBY);
  assert.equal(resolveGalleryZone({ z: 0 }), ZONES.CORRIDOR);
  assert.equal(resolveGalleryZone({ z: -16 }), ZONES.MAIN_ROOM);
});

test("solo añade una zona vecina cerca de una transición", () => {
  assert.deepEqual(
    [...resolveInterestZones({ z: 18 })],
    [ZONES.LOBBY]
  );
  assert.deepEqual(
    [...resolveInterestZones({ z: 11 })],
    [ZONES.LOBBY, ZONES.CORRIDOR]
  );
  assert.deepEqual(
    [...resolveInterestZones({ z: 0 })],
    [ZONES.CORRIDOR]
  );
  assert.deepEqual(
    [...resolveInterestZones({ z: -7 })],
    [ZONES.CORRIDOR, ZONES.MAIN_ROOM]
  );
});

test("compara conjuntos de interés sin depender del orden", () => {
  assert.equal(
    haveSameZones(
      new Set([ZONES.LOBBY, ZONES.CORRIDOR]),
      new Set([ZONES.CORRIDOR, ZONES.LOBBY])
    ),
    true
  );
  assert.equal(
    haveSameZones(
      new Set([ZONES.LOBBY]),
      new Set([ZONES.CORRIDOR])
    ),
    false
  );
});
