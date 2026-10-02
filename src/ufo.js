// The saucer, its beam cone, and the glowing ground ring.
import * as THREE from 'three';
import { mat } from './models.js';

export function buildUfo(scene) {
  const ufo = new THREE.Group();

  const hull = new THREE.LatheGeometry([
    new THREE.Vector2(0.0, -0.45),
    new THREE.Vector2(1.0, -0.4),
    new THREE.Vector2(2.3, -0.05),
    new THREE.Vector2(2.4, 0.08),
    new THREE.Vector2(1.6, 0.4),
    new THREE.Vector2(0.0, 0.45),
  ], 24);
  const hullMesh = new THREE.Mesh(hull, mat(0xb8c4d6));
  hullMesh.castShadow = true;
  ufo.add(hullMesh);

  const band = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.14, 6, 32), mat(0x9b5de5));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.02;
  ufo.add(band);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.75, emissive: 0x1b6f8a })
  );
  dome.position.y = 0.35;
  ufo.add(dome);

  const lights = [];
  const colors = [0xfff35c, 0x5cf2ff, 0xff5cf4];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: colors[i % 3] }));
    l.position.set(Math.cos(a) * 2.05, -0.12, Math.sin(a) * 2.05);
    ufo.add(l);
    lights.push(l);
  }

  const belly = new THREE.Mesh(
    new THREE.CircleGeometry(0.8, 20),
    new THREE.MeshBasicMaterial({ color: 0xbff6ff })
  );
  belly.rotation.x = Math.PI / 2;
  belly.position.y = -0.46;
  ufo.add(belly);
  scene.add(ufo);

  // Beam: unit-height cone, scaled every frame to reach the ground.
  const beamGeo = new THREE.CylinderGeometry(0.35, 1, 1, 28, 1, true);
  beamGeo.translate(0, -0.5, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
    color: 0x9ff3ff, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  scene.add(beam);

  const ring = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({
    color: 0x6fdcff, transparent: true, opacity: 0.28, depthWrite: false,
  }));
  const edge = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({
    color: 0xd6fbff, transparent: true, opacity: 0.85, depthWrite: false,
  }));
  disc.rotation.x = edge.rotation.x = -Math.PI / 2;
  ring.add(disc, edge);
  ring.position.y = 0.06;
  scene.add(ring);

  return { ufo, beam, ring, lights, edge };
}
