/* =========================================================
   Nuit Noire — jeu d'horreur 3D dans un château abandonné
   - Vue subjective "bodycam" : le corps du perso est accroché
     à la caméra (visible en regardant vers le bas)
   - Minicarte en haut à gauche avec la position du joueur
   - Date et heure en direct façon caméra embarquée
   ========================================================= */

(function () {
  'use strict';

  // ---------- Scène de base ----------
  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060c);
  scene.fog = new THREE.FogExp2(0x04060c, 0.013); // brouillard de nuit (espace 2x plus grand)

  var camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 250);
  scene.add(camera); // la caméra est dans la scène : on y accroche le corps

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  if (THREE.ACESFilmicToneMapping) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; }
  document.getElementById('scene').appendChild(renderer.domElement);

  // ---------- Textures procédurales (réalistes, générées en canvas) ----------
  function bruitCanvas(g, n, alpha, teinte) {
    for (var i = 0; i < n; i++) {
      g.fillStyle = 'rgba(' + teinte + ',' + (Math.random() * alpha) + ')';
      g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }
  function texPierre(lum) { // mur de briques de pierre
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = 'rgb(' + (38 * lum | 0) + ',' + (38 * lum | 0) + ',' + (44 * lum | 0) + ')';
    g.fillRect(0, 0, 256, 256);
    var bh = 32, bw = 64;
    for (var y = 0, row = 0; y < 256; y += bh, row++) {
      var off = (row % 2) ? bw / 2 : 0;
      for (var x = -bw; x < 256 + bw; x += bw) {
        var v = 0.75 + Math.random() * 0.5;
        var r = 88 * lum * v | 0, gg = 88 * lum * v | 0, b = 98 * lum * v | 0;
        g.fillStyle = 'rgb(' + r + ',' + gg + ',' + b + ')';
        g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
        // petit relief sur la brique
        g.fillStyle = 'rgba(255,255,255,0.05)';
        g.fillRect(x + off + 2, y + 2, bw - 4, 3);
        g.fillStyle = 'rgba(0,0,0,0.18)';
        g.fillRect(x + off + 2, y + bh - 5, bw - 4, 3);
      }
    }
    bruitCanvas(g, 900, 0.16, '0,0,0');
    bruitCanvas(g, 500, 0.08, '255,255,255');
    // fissures
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
    for (var f = 0; f < 6; f++) {
      g.beginPath();
      var fx = Math.random() * 256, fy = Math.random() * 256;
      g.moveTo(fx, fy);
      for (var s = 0; s < 5; s++) { fx += (Math.random() - 0.5) * 30; fy += Math.random() * 20; g.lineTo(fx, fy); }
      g.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1.2);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function texRouille() { // acier avec taches de rouille
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = 'rgb(150,155,162)'; g.fillRect(0, 0, 128, 128);
    bruitCanvas(g, 500, 0.15, '255,255,255');
    bruitCanvas(g, 500, 0.2, '60,60,66');
    for (var i = 0; i < 18; i++) {
      g.fillStyle = 'rgba(' + (120 + Math.random() * 60 | 0) + ',' + (55 + Math.random() * 30 | 0) + ',25,' + (0.25 + Math.random() * 0.4) + ')';
      g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 9, 0, Math.PI * 2); g.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // Modèle réaliste de pied de biche : manche plat + griffe courbée + talon
  function modelePiedDeBiche() {
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({ color: 0xc2c8cf, map: texRouille(), metalness: 0.85, roughness: 0.45 });
    var manche = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 1.0), mat);
    manche.castShadow = true;
    var griffe = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 0.2), mat);
    griffe.position.set(0, 0.005, 0.56); griffe.rotation.x = -0.9; griffe.castShadow = true;
    var talon = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.03, 0.12), mat);
    talon.position.set(0, -0.005, -0.53); talon.rotation.x = 0.7;
    g.add(manche, griffe, talon);
    return g;
  }

  // Modèle réaliste de pistolet (glissière, canon, carcasse, poignée, pontet, guidon...)
  function modelePistolet() {
    var g = new THREE.Group();
    var metal = new THREE.MeshStandardMaterial({ color: 0x2e3238, metalness: 0.95, roughness: 0.3 });
    var gripMat = new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.85 });
    var slide = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.3), metal);
    slide.position.set(0, 0.06, -0.05); slide.castShadow = true;
    var canon = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8), metal);
    canon.rotation.x = Math.PI / 2; canon.position.set(0, 0.06, -0.22);
    var frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.24), metal);
    frame.position.set(0, 0.02, -0.02);
    var poignee = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.08), gripMat);
    poignee.position.set(0, -0.08, 0.06); poignee.rotation.x = 0.2; poignee.castShadow = true;
    var pontet = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 6, 10, Math.PI), metal);
    pontet.position.set(0, 0.0, 0.0); pontet.rotation.z = Math.PI;
    var detente = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, 0.012), metal);
    detente.position.set(0, -0.018, 0.0);
    var guidon = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.016, 0.008), metal);
    guidon.position.set(0, 0.095, -0.18);
    var hausse = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.01), metal);
    hausse.position.set(0, 0.09, 0.08);
    var chien = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.02), metal);
    chien.position.set(0, 0.078, 0.11); chien.rotation.x = -0.4;
    var embase = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.015, 0.09), metal);
    embase.position.set(0, -0.165, 0.06);
    g.add(slide, canon, frame, poignee, pontet, detente, guidon, hausse, chien, embase);
    return g;
  }

  function modeleSniper() { // fusil de sniper : long canon + lunette + crosse en bois
    var metal = new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.9, roughness: 0.35 });
    var boisMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 });
    var g = new THREE.Group();
    var canon = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.1, 10), metal);
    canon.rotation.x = Math.PI / 2; canon.position.set(0, 0.06, -0.55); g.add(canon);
    var corps = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.5), metal);
    corps.position.set(0, 0.02, 0); g.add(corps);
    var visee = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 10), metal);
    visee.position.set(0, 0.13, -0.1); g.add(visee); // lunette de visée
    var crosse = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.4), boisMat);
    crosse.position.set(0, -0.02, 0.42); crosse.rotation.x = 0.15; g.add(crosse);
    var detente = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.06), metal);
    detente.position.set(0, -0.06, 0.15); g.add(detente);
    return g;
  }

  function texBois(lum) { // planches de bois
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = 'rgb(' + (70 * lum | 0) + ',' + (48 * lum | 0) + ',' + (28 * lum | 0) + ')';
    g.fillRect(0, 0, 256, 256);
    for (var p = 0; p < 4; p++) { // 4 planches verticales
      var v = 0.8 + Math.random() * 0.4;
      g.fillStyle = 'rgb(' + (110 * lum * v | 0) + ',' + (75 * lum * v | 0) + ',' + (42 * lum * v | 0) + ')';
      g.fillRect(p * 64 + 2, 0, 60, 256);
      // veines du bois
      g.strokeStyle = 'rgba(30,18,8,0.5)'; g.lineWidth = 1;
      for (var l = 0; l < 7; l++) {
        g.beginPath();
        var x = p * 64 + 6 + Math.random() * 52;
        g.moveTo(x, 0);
        for (var y = 0; y <= 256; y += 32) g.lineTo(x + (Math.random() - 0.5) * 6, y);
        g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(p * 64, 0, 3, 256);
    }
    bruitCanvas(g, 700, 0.12, '0,0,0');
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 1);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // ---------- Lumières ----------
  var lune = new THREE.DirectionalLight(0x8fa3cc, 0.3);
  lune.position.set(80, 140, -60);
  lune.castShadow = true;
  lune.shadow.mapSize.set(1024, 1024);
  lune.shadow.camera.left = -120; lune.shadow.camera.right = 120;
  lune.shadow.camera.top = 120; lune.shadow.camera.bottom = -120;
  scene.add(lune);
  var ambient = new THREE.AmbientLight(0x141a26, 0.7);
  scene.add(ambient);

  // Quand la lampe torche est éteinte : noir total (seuls les objets/yeux lumineux restent visibles)
  function majLumiereGenerale() {
    var k = torcheOn ? 1 : 0;
    lune.intensity = 0.3 * k;
    ambient.intensity = 0.7 * k;
    if (typeof lumMain !== 'undefined') lumMain.intensity = torcheOn ? 0.5 : 0;
  }

  // Lampe torche attachée à la caméra
  var torche = new THREE.SpotLight(0xfff2cc, 2.6, 100, Math.PI / 6.5, 0.45, 1.6);
  torche.castShadow = true;
  torche.shadow.mapSize.set(512, 512);
  camera.add(torche);
  camera.add(torche.target);
  torche.position.set(0.18, -0.22, 0.05);
  torche.target.position.set(0.1, -0.35, -12);

  // ---------- Matériaux pierre (texturés) ----------
  var pierre = new THREE.MeshStandardMaterial({ map: texPierre(1.0), roughness: 0.92 });
  var pierreSombre = new THREE.MeshStandardMaterial({ map: texPierre(0.55), roughness: 1 });
  var pierreGrise = new THREE.MeshStandardMaterial({ map: texPierre(0.8), roughness: 0.9 });
  // Matériaux bois déclarés tôt (utilisés par la crypte avant la section meubles)
  var bois = new THREE.MeshStandardMaterial({ map: texBois(0.75), roughness: 0.9 });
  var boisClair = new THREE.MeshStandardMaterial({ map: texBois(1.05), roughness: 0.85 });
  var tissuLit = new THREE.MeshStandardMaterial({ color: 0x3a2f3f, roughness: 1 });

  // ---------- Sol (cour de château : dalles sombres) ----------
  var sol = new THREE.Mesh(
    new THREE.PlaneGeometry(1000, 1000, 1, 1), // assez grand pour couvrir aussi l'école (partie 2)
    new THREE.MeshStandardMaterial({ color: 0x232329, roughness: 1 })
  );
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);

  // Motif de dalles peint sur une texture procédurale
  (function dalles() {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#2b2b34'; g.fillRect(0, 0, 256, 256);
    // chaque dalle a sa propre teinte + usure
    for (var ty = 0; ty < 4; ty++) for (var tx = 0; tx < 4; tx++) {
      var v = 0.8 + Math.random() * 0.45;
      g.fillStyle = 'rgb(' + (43 * v | 0) + ',' + (43 * v | 0) + ',' + (52 * v | 0) + ')';
      g.fillRect(tx * 64 + 2, ty * 64 + 2, 60, 60);
      // taches d'humidité
      for (var s = 0; s < 4; s++) {
        g.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.22) + ')';
        g.beginPath();
        g.arc(tx * 64 + 8 + Math.random() * 48, ty * 64 + 8 + Math.random() * 48, 3 + Math.random() * 9, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = '#15151b'; g.lineWidth = 3;
    for (var i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
    }
    // fissures dans les dalles
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
    for (var f = 0; f < 5; f++) {
      g.beginPath();
      var fx = Math.random() * 256, fy = Math.random() * 256;
      g.moveTo(fx, fy);
      for (var k = 0; k < 4; k++) { fx += (Math.random() - 0.5) * 40; fy += (Math.random() - 0.5) * 40; g.lineTo(fx, fy); }
      g.stroke();
    }
    bruitCanvas(g, 800, 0.1, '0,0,0');
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(80, 80);
    if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    sol.material.map = tex;
    sol.material.color.set(0xffffff);
    sol.material.roughness = 0.85;
    sol.material.needsUpdate = true;
  })();

  function hauteurSol() {
    if (pos.y < -6) return -12; // souterrain sous l'école (partie 2)
    if (trappeOuverte && pos.x > -2.2 && pos.x < 2.2 && pos.z > 274.8 && pos.z < 279.2) return -12; // trou de la trappe DERRIÈRE la porte (z=280)
    return 0; // sol plat du château / de l'école
  }

  // ---------- Obstacles & murs (pour collisions ET minicarte) ----------
  var rects = [];   // murs : {x, z, sx, sz} en coordonnées monde (pour la carte)
  var cercles = []; // obstacles ronds {x, z, r}
  var conteneursMunitions = []; // caisses contenant des balles (déclaré tôt : la crypte en utilise)

  // Clone la texture avec une répétition adaptée à la taille réelle du mur
  // (sinon les briques sont étirées sur les grands murs)
  function texMur(m, sx, h) {
    if (!m.material.map) return;
    m.material = m.material.clone();
    m.material.map = m.material.map.clone();
    m.material.map.wrapS = m.material.map.wrapT = THREE.RepeatWrapping;
    m.material.map.repeat.set(Math.max(1, sx / 6), Math.max(1, h / 6));
    m.material.map.needsUpdate = true;
  }

  // Mur rectangulaire centré en (cx, cz), tailles (sx, sz), hauteur h
  function mur(cx, cz, sx, sz, h, materiau) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), materiau || pierre);
    texMur(m, Math.max(sx, sz), h);
    m.position.set(cx, h / 2, cz);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    rects.push({ x: cx, z: cz, sx: sx, sz: sz });
    return m;
  }

  // Tour ronde
  function tour(x, z, r, h) {
    var t = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, h, 12), pierreSombre);
    texMur(t, Math.PI * 2 * r, h);
    t.position.set(x, h / 2, z);
    t.castShadow = true; t.receiveShadow = true;
    scene.add(t);
    // toit conique effondré
    var toit = new THREE.Mesh(new THREE.ConeGeometry(r * 1.05, h * 0.45, 12), pierreGrise);
    toit.position.set(x, h + h * 0.2, z);
    toit.rotation.y = Math.PI / 6;
    toit.castShadow = true;
    scene.add(toit);
    cercles.push({ x: x, z: z, r: r + 0.2 });
    rects.push({ x: x, z: z, sx: r * 2, sz: r * 2, rond: true });
  }

  // Pilier
  function pilier(x, z, r, h) {
    r = r || 0.55; h = h || 6;
    var p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.1, h, 10), pierreGrise);
    texMur(p, Math.PI * 2 * r, h);
    p.position.set(x, h / 2, z);
    p.castShadow = true; p.receiveShadow = true;
    scene.add(p);
    // chapiteau
    var chap = new THREE.Mesh(new THREE.BoxGeometry(r * 2.6, 0.4, r * 2.6), pierre);
    chap.position.set(x, h + 0.2, z);
    chap.castShadow = true;
    scene.add(chap);
    cercles.push({ x: x, z: z, r: r + 0.15 });
  }

  // ---------- LE CHÂTEAU (grand : échelle x2) ----------
  var E = 84;      // demi-côté des remparts extérieurs
  var EPAIS = 3.2; // épaisseur des murs
  var H = 14;      // hauteur des remparts

  // Remparts extérieurs (avec poterne au sud, x entre -6 et 6)
  // Rempart nord en deux morceaux : ouverture de 6 m pile (x -3..3) pour la porte de la crypte
  var segR = (E * 2 + EPAIS - 6) / 2;
  mur(-(3 + segR / 2), -E, segR, EPAIS, H);               // nord ouest
  mur((3 + segR / 2), -E, segR, EPAIS, H);                // nord est
  mur(-(E + 6) / 2 - 3, E, E - 6 + EPAIS, EPAIS, H);       // sud ouest
  mur((E + 6) / 2 + 3, E, E - 6 + EPAIS, EPAIS, H);         // sud est (poterne entre les deux)
  mur(E, 0, EPAIS, E * 2 + EPAIS, H);                      // est
  mur(-E, 0, EPAIS, E * 2 + EPAIS, H);                     // ouest
  // Bretèche au-dessus de la poterne, avec son toit
  mur(0, E, 12, EPAIS, H + 5);
  toit(0, E, 15, EPAIS + 5, H + 6.8);

  // Tours d'angle
  tour(E, E, 6, 22); tour(-E, E, 6, 22); tour(E, -E, 6, 22); tour(-E, -E, 6, 22);

  // Donjon (bâtiment nord : x -28..28, z -84..-48, porte au sud)
  var DK = 28, DZ = -48;
  // Mur nord du donjon avec une ouverture de 6 m pile (x -3..3) pour la porte de la crypte
  var segW = (DK * 2 + EPAIS - 6) / 2; // largeur de chaque morceau de mur
  mur(-(3 + segW / 2), -E, segW, EPAIS, 16, pierreSombre); // nord ouest
  mur((3 + segW / 2), -E, segW, EPAIS, 16, pierreSombre);  // nord est

  // ---------- La crypte (pièce secrète au nord du donjon) — GRANDE salle de combat ----------
  mur(0, -120, 48 + EPAIS, EPAIS, 12);          // fond de la crypte
  mur(-24, -102, EPAIS, 36 + EPAIS, 12);        // mur ouest
  mur(24, -102, EPAIS, 36 + EPAIS, 12);         // mur est
  toit(0, -102, 48 + EPAIS, 36 + EPAIS, 12.3);  // toit de la crypte
  // Porte de la crypte : VRAIE porte battante sur gond (charnière à x=-3), pleine hauteur (16 m)
  var pivotCrypte = new THREE.Group();
  pivotCrypte.position.set(-3, 0, -E);
  scene.add(pivotCrypte);
  var porteCrypte = new THREE.Mesh(new THREE.BoxGeometry(6, 16, EPAIS),
    new THREE.MeshStandardMaterial({ map: texBois(0.6), roughness: 0.8 }));
  porteCrypte.position.set(3, 8, 0); // vantail dans le repère du pivot
  porteCrypte.castShadow = true; porteCrypte.receiveShadow = true;
  texMur(porteCrypte, 6, 16);
  // panneau arrière opaque : on ne voit plus à travers les interstices des planches
  var fondCrypte = new THREE.Mesh(new THREE.BoxGeometry(6.05, 16.05, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x241708, roughness: 0.95 }));
  fondCrypte.position.set(0, 0, -EPAIS / 2 + 0.07);
  porteCrypte.add(fondCrypte);
  pivotCrypte.add(porteCrypte);
  var serrureCrypte = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x66ff88, metalness: 0.9, roughness: 0.3, emissive: 0x114422 }));
  serrureCrypte.position.set(2.4, -0.8, EPAIS / 2 + 0.1);
  porteCrypte.add(serrureCrypte); // la serrure pivote avec la porte
  // Vrai cadre de porte en pierre autour de l'ouverture + poignée
  mur(-3.4, -E, 0.8, EPAIS + 0.4, 16.6, pierreGrise); // montant ouest
  mur(3.4, -E, 0.8, EPAIS + 0.4, 16.6, pierreGrise);  // montant est
  var lintelCrypte = mur(0, -E, 7.6, EPAIS + 0.4, 0.8, pierreGrise); // linteau
  lintelCrypte.position.y = 16.2;
  rects.pop(); // le linteau est en hauteur : pas de collision au sol
  var poigneeCrypte = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.9, roughness: 0.4 }));
  poigneeCrypte.position.set(-0.9, 0, EPAIS / 2 + 0.15);
  porteCrypte.add(poigneeCrypte);
  var rectCrypte = { x: 0, z: -E, sx: 6, sz: EPAIS };
  rects.push(rectCrypte);
  var rectCrypteRetire = false;
  var crypteOuverte = false, crypteEnCours = false, boutonT = 0;
  // Éclairage sinistre de la crypte + déco (piliers, sarcophage, bouton central)
  var lumCrypte = new THREE.PointLight(0x66ff88, 0.7, 30, 1.6);
  lumCrypte.position.set(0, 5, -94);
  scene.add(lumCrypte);
  var lumCrypte2 = new THREE.PointLight(0x66ff88, 0.5, 30, 1.6);
  lumCrypte2.position.set(0, 6, -112);
  scene.add(lumCrypte2);
  pilier(-18, -90, 0.8, 10); pilier(18, -90, 0.8, 10);
  pilier(-18, -102, 0.8, 10); pilier(18, -102, 0.8, 10);
  pilier(-18, -114, 0.8, 10); pilier(18, -114, 0.8, 10);
  var sarco = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 2.2), pierreGrise);
  sarco.position.set(0, 0.4, -116); sarco.castShadow = true; sarco.receiveShadow = true;
  scene.add(sarco);
  cercles.push({ x: 0, z: -116, r: 1.2 });
  // Bouton rouge au centre de la salle : appuyer dessus (E) fait apparaître le boss
  var socle = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), pierreGrise);
  socle.position.set(0, 0.55, -102); socle.castShadow = true; socle.receiveShadow = true;
  scene.add(socle);
  var bouton = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.7),
    new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2222, emissiveIntensity: 0.9, roughness: 0.4 }));
  bouton.position.set(0, 1.25, -102);
  scene.add(bouton);
  cercles.push({ x: 0, z: -102, r: 1.0 });
  // Munitions dans la crypte
  caisseAmmo(-18, -96); caisseAmmo(18, -110);
  mur(-(DK + 5) / 2 - 2.5, DZ, DK - 5 + EPAIS, EPAIS, 16);            // sud ouest
  mur((DK + 5) / 2 + 2.5, DZ, DK - 5 + EPAIS, EPAIS, 16);             // sud est (porte)
  mur(DK, (-E + DZ) / 2, EPAIS, (-DZ + E) + EPAIS, 16);               // est
  mur(-DK, (-E + DZ) / 2, EPAIS, (-DZ + E) + EPAIS, 16);              // ouest
  // Toit du donjon, partiellement effondré (pas de collision : il est en hauteur)
  function toit(cx, cz, sx, sz, y) {
    var dalle = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.4, sz), pierreSombre);
    texMur(dalle, sx, sz);
    dalle.position.set(cx, y, cz);
    dalle.rotation.y = (Math.random() - 0.5) * 0.06;
    dalle.castShadow = true; dalle.receiveShadow = true;
    scene.add(dalle);
  }
  toit(0, -66, DK * 2 + EPAIS, E - DZ + EPAIS, 16.6); // donjon : toit complet
  toit(-68, 0, 32 + EPAIS, 48 + EPAIS, 12.6);         // aile ouest : toit complet
  toit(68, 0, 32 + EPAIS, 48 + EPAIS, 12.6);          // aile est : toit complet
  // Grande toiture sur toute la cour intérieure, posée sur les remparts :
  // le château est maintenant entièrement couvert (donjon et ailes dépassent du toit)
  toit(0, 0, 164, 164, 14.4);
  // Piliers à l'intérieur du donjon
  pilier(-16, -66, 1.4, 16); pilier(16, -66, 1.4, 16); pilier(-16, -58, 1.4, 16); pilier(16, -58, 1.4, 16);

  // Porte verrouillée du donjon : exactement aux dimensions de l'ouverture du mur
  // (ouverture : 5 de large, 8 de haut, mur de 1.6 d'épaisseur) → porte bien collée, à fleur
  var porte = new THREE.Mesh(new THREE.BoxGeometry(10, 16, 3.2),
    new THREE.MeshStandardMaterial({ map: texBois(0.85), roughness: 0.75 }));
  porte.position.set(0, 8, DZ);
  porte.castShadow = true; porte.receiveShadow = true;
  texMur(porte, 10, 16); // planches à la bonne échelle sur la porte
  scene.add(porte);
  // Serrure sur la face avant de la porte (côté cour)
  var serrureMat = new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.9, roughness: 0.3, emissive: 0x000000 });
  var serrure = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.3), serrureMat);
  serrure.position.set(1.6, -3.8, 1.7);
  porte.add(serrure); // la serrure est fixée SUR la porte : elle monte avec quand on ouvre
  var rectPorte = { x: 0, z: DZ, sx: 10, sz: 3.2 };
  rects.push(rectPorte);
  var porteOuverte = false, porteEnCours = false;

  // Aile ouest (x -84..-52, z -24..24, porte côté cour)
  mur(-68, -24, 32 + EPAIS, EPAIS, 12);  // nord
  mur(-68, 24, 32 + EPAIS, EPAIS, 12);   // sud
  mur(-E, 0, EPAIS, 48 + EPAIS, 12);     // ouest (plaqué contre le rempart)
  mur(-52, -14, EPAIS, 20 + EPAIS, 12);  // est partie nord
  mur(-52, 14, EPAIS, 20 + EPAIS, 12);   // est partie sud (porte entre les deux)

  // Aile est (miroir)
  mur(68, -24, 32 + EPAIS, EPAIS, 12);
  mur(68, 24, 32 + EPAIS, EPAIS, 12);
  mur(E, 0, EPAIS, 48 + EPAIS, 12);
  mur(52, -14, EPAIS, 20 + EPAIS, 12);
  mur(52, 14, EPAIS, 20 + EPAIS, 12);

  // ---------- Portes battantes des ailes (s'ouvrent toutes seules) ----------
  var portesPivot = [];
  function portePivotante(px, pz, longueur, cote) {
    var pivot = new THREE.Group();
    pivot.position.set(px, 0, pz);
    var vantail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, longueur),
      new THREE.MeshStandardMaterial({ map: texBois(0.9), roughness: 0.8 }));
    vantail.position.set(0, 2.5, cote * longueur / 2);
    vantail.castShadow = true; vantail.receiveShadow = true;
    // poignée
    var poignee = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.9, roughness: 0.3 }));
    poignee.position.set(-0.2, 2.5, cote * (longueur / 2 - 0.5));
    pivot.add(vantail, poignee);
    scene.add(pivot);
    var rect = { x: px, z: pz + cote * longueur / 2, sx: 1.2, sz: longueur }; // bloque TOUTE l'ouverture
    rects.push(rect);
    var porte = { pivot: pivot, rect: rect, ouvert: false, angle: 0, cote: cote, cx: px, cz: pz + cote * longueur / 2 };
    portesPivot.push(porte);
  }
  portePivotante(-52, -4, 8, 1);  // porte de l'aile ouest (mur est)
  portePivotante(52, 4, 8, -1);   // porte de l'aile est (mur ouest)

  // ---------- Cour intérieure : fontaine cassée, débris, colonnade ----------
  (function fontaine() {
    var bassin = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, 2, 14), pierreSombre);
    bassin.position.set(0, 1, 0); bassin.castShadow = true; bassin.receiveShadow = true;
    var colonne = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1, 5.2, 8), pierreGrise);
    colonne.position.set(0, 4.4, 0); colonne.rotation.z = 0.25; // penchée, cassée
    colonne.castShadow = true;
    scene.add(bassin, colonne);
    cercles.push({ x: 0, z: 0, r: 5.6 });
    rects.push({ x: 0, z: 0, sx: 11.2, sz: 11.2, rond: true });
  })();

  // ---------- Meubles dans les salles ----------

  function caisse(x, z, s) {
    s = s || 0.7;
    var c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), bois);
    c.position.set(x, s / 2, z);
    c.rotation.y = Math.random() * 0.6;
    c.castShadow = true; c.receiveShadow = true;
    scene.add(c);
    cercles.push({ x: x, z: z, r: s * 0.75 });
  }

  function tonneau(x, z) { // tonneau en bois avec cerclages
    var g = new THREE.Group();
    var fut = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 12), boisClair);
    fut.position.y = 0.5; fut.castShadow = true; fut.receiveShadow = true;
    g.add(fut);
    for (var i = 0; i < 2; i++) {
      var cerc = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.03, 6, 16),
        new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.7, roughness: 0.5 }));
      cerc.position.y = 0.25 + i * 0.5;
      cerc.rotation.x = Math.PI / 2;
      g.add(cerc);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    cercles.push({ x: x, z: z, r: 0.55 });
  }

  function pileLivres(x, z) { // pile de vieux livres
    var g = new THREE.Group();
    for (var i = 0; i < 4; i++) {
      var l = new THREE.Mesh(new THREE.BoxGeometry(0.4 - i * 0.04, 0.07, 0.3),
        new THREE.MeshStandardMaterial({ color: [0x5a2e2e, 0x2e4a2e, 0x2e2e5a, 0x6a5a2e][i], roughness: 1 }));
      l.position.y = 0.035 + i * 0.07;
      l.rotation.y = (Math.random() - 0.5) * 0.5;
      l.castShadow = true;
      g.add(l);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    cercles.push({ x: x, z: z, r: 0.35 });
  }

  function planches(x, z) { // tas de planches de bois
    var g = new THREE.Group();
    for (var i = 0; i < 3; i++) {
      var p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 1.4 - i * 0.2), boisClair);
      p.position.y = 0.025 + i * 0.05;
      p.rotation.y = (Math.random() - 0.5) * 0.4;
      p.castShadow = true; p.receiveShadow = true;
      g.add(p);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    cercles.push({ x: x, z: z, r: 0.8 });
  }

  // Caisses contenant des munitions (fouillables)
  function caisseAmmo(x, z) {
    caisse(x, z, 0.9);
    var balle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.3, emissive: 0x332200 }));
    balle.position.set(x, 1.0, z);
    scene.add(balle);
    conteneursMunitions.push({ x: x, z: z, pris: false, marqueur: balle });
  }

  function table(x, z) {
    var g = new THREE.Group();
    var plateau = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.9), boisClair);
    plateau.position.y = 0.75; plateau.castShadow = true; plateau.receiveShadow = true;
    g.add(plateau);
    [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]].forEach(function (p) {
      var pied = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.75, 6), bois);
      pied.position.set(p[0], 0.375, p[1]);
      pied.castShadow = true;
      g.add(pied);
    });
    g.position.set(x, 0, z);
    g.rotation.y = Math.random() * Math.PI;
    scene.add(g);
    cercles.push({ x: x, z: z, r: 1.0 });
    return 0.79; // hauteur du plateau
  }

  function chaise(x, z, ry) {
    var g = new THREE.Group();
    var siege = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.45), boisClair);
    siege.position.y = 0.45; siege.castShadow = true;
    var dossier = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.06), boisClair);
    dossier.position.set(0, 0.75, -0.2); dossier.castShadow = true;
    g.add(siege, dossier);
    [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].forEach(function (p) {
      var pied = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.45, 6), bois);
      pied.position.set(p[0], 0.225, p[1]);
      g.add(pied);
    });
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    scene.add(g);
    cercles.push({ x: x, z: z, r: 0.4 });
  }

  function etagere(x, z) {
    var g = new THREE.Group();
    var fond = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.3, 0.12), bois);
    fond.position.y = 1.15; fond.castShadow = true; fond.receiveShadow = true;
    g.add(fond);
    for (var i = 0; i < 3; i++) {
      var tablette = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.4), boisClair);
      tablette.position.set(0, 0.5 + i * 0.65, 0.1);
      tablette.castShadow = true;
      g.add(tablette);
    }
    // vieux livres / objets posés
    for (var l = 0; l < 5; l++) {
      var livre = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.22),
        new THREE.MeshStandardMaterial({ color: [0x5a2e2e, 0x2e4a2e, 0x2e2e5a][l % 3], roughness: 1 }));
      livre.position.set(-0.7 + l * 0.14, 0.8, 0.12);
      livre.rotation.z = l === 4 ? 0.3 : 0;
      g.add(livre);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    rects.push({ x: x, z: z, sx: 1.9, sz: 0.5 });
  }

  function lit(x, z, ry) {
    var g = new THREE.Group();
    // 4 pieds : le lit est surélevé, il y a de la place pour se glisser dessous
    [[-0.5, -0.95], [0.5, -0.95], [-0.5, 0.95], [0.5, 0.95]].forEach(function (p) {
      var pied = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.6, 8), bois);
      pied.position.set(p[0], 0.3, p[1]);
      pied.castShadow = true;
      g.add(pied);
    });
    var cadre = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 2.1), bois);
    cadre.position.y = 0.8; cadre.castShadow = true; cadre.receiveShadow = true;
    var matelas = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 2.0), tissuLit);
    matelas.position.y = 1.12; matelas.castShadow = true;
    var oreiller = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x777788, roughness: 1 }));
    oreiller.position.set(0, 1.3, -0.8);
    g.add(cadre, matelas, oreiller);
    g.position.set(x, 0, z);
    g.rotation.y = ry || 0;
    scene.add(g);
    litCollision = { x: x, z: z, r: 1.2 };
    cercles.push(litCollision);
  }
  var litCollision = null; // collision du lit (ignorée quand on est caché dessous)

  // Aile ouest (salle de la clé) : bien remplie
  var hautTableOuest = table(-68, 0);
  chaise(-71.2, -2, 0.6); chaise(-64.8, 2, Math.PI - 0.6);
  etagere(-68, -22); etagere(-68, 22); etagere(-80, 0);
  caisse(-76, 16); caisse(-77.6, 17.2, 0.5); caisse(-60, -18); caisse(-78, -14); caisse(-58, 18);
  tonneau(-74, 8); tonneau(-74, 10.5); tonneau(-62, -14);
  pileLivres(-68, 1.2); pileLivres(-66.5, -1.5);
  table(-60, 14); chaise(-61.5, 12.5, 1.2); chaise(-58.5, 15.5, -1.2);

  // Aile est (salle du pied de biche) : bien remplie
  lit(66, -16, Math.PI / 2); etagere(76, 0); caisse(60, 18); chaise(62, -6, 2);
  var litPos = { x: 66, z: -16 }; // position du lit (pour s'y cacher)
  table(66, 10); chaise(64.5, 8.5, 0.8); chaise(67.5, 11.5, Math.PI - 0.8);
  etagere(60, -22); etagere(76, 14);
  caisse(72, -20); caisse(73.5, -18.5, 0.5); caisse(58, 16); tonneau(72, 16); tonneau(60, -8);
  pileLivres(66, 11.2); pileLivres(70, -2);

  // Donjon : grande table, étagères, caisses + le coffre verrouillé
  table(0, -60); chaise(-2.4, -62, 0.4); chaise(2.4, -58, Math.PI);
  etagere(-26, -81.6); etagere(26, -81.6); caisse(-22, -56); caisse(22, -72, 0.6);
  tonneau(-20, -75); caisse(20, -78); pileLivres(0, -58.5);
  caisse(-8, -70); caisse(8, -76, 0.7); planches(14, -62); tonneau(24, -66); caisseAmmo(-12, -72); caisseAmmo(18, -70);

  // Colonnade autour de la cour
  pilier(-36, 36, 1, 10); pilier(36, 36, 1, 10);
  pilier(-36, -36, 1, 10); pilier(36, -36, 1, 10);

  // ---------- Le bordel dans la cour : plein d'objets partout ----------
  var nbMun = 0;
  for (var b = 0; b < 55; b++) {
    var ba = Math.random() * Math.PI * 2;
    var br = 12 + Math.random() * 58;
    var bx = Math.cos(ba) * br, bz = Math.sin(ba) * br;
    if (Math.abs(bx) < 12 && bz > -54 && bz < -40) continue; // pas devant la porte du donjon
    if (Math.abs(bx) < 9 && bz > 72) continue;                // pas dans la poterne
    if (Math.abs(bx) > 46 && Math.abs(bz) < 30) continue;     // pas dans les ailes
    var choix = Math.random();
    if (choix < 0.3) caisse(bx, bz, 0.7 + Math.random() * 1.0);
    else if (choix < 0.55) tonneau(bx, bz);
    else if (choix < 0.75) pileLivres(bx, bz);
    else planches(bx, bz);
    // 6 caisses contiennent des munitions
    if (nbMun < 6 && choix < 0.3 && Math.random() < 0.25) { caisseAmmo(bx + 1.2, bz); nbMun++; }
  }

  // Quelques arbres morts dehors, derrière les remparts
  var troncMat = new THREE.MeshStandardMaterial({ color: 0x241d19, roughness: 0.95 });
  for (var t = 0; t < 25; t++) {
    var aa = Math.random() * Math.PI * 2;
    var rr = E + 12 + Math.random() * 80;
    var tx = Math.cos(aa) * rr, tz = Math.sin(aa) * rr;
    var h = 10 + Math.random() * 10;
    var tronc = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, h, 6), troncMat);
    tronc.position.set(tx, h / 2, tz);
    tronc.rotation.z = (Math.random() - 0.5) * 0.2;
    tronc.castShadow = true;
    scene.add(tronc);
  }

  // ---------- Torches murales (lumières orange qui tremblent) ----------
  var flammes = [];
  function torcheMurale(x, y, z, ry) {
    var support = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.5, 6), pierreSombre);
    support.position.set(x, y, z);
    var flamme = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffa726 })
    );
    flamme.position.set(x, y + 0.35, z);
    var lum = new THREE.PointLight(0xff8c3a, 0.75, 13, 1.8);
    lum.position.set(x, y + 0.4, z);
    scene.add(support, flamme, lum);
    flammes.push({ flamme: flamme, lum: lum });
    // applique murale
    var ap = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.15), pierreSombre);
    ap.position.set(x, y, z); ap.rotation.y = ry || 0;
    scene.add(ap);
  }
  // Plus de torches murales : le château est éclairé UNIQUEMENT par ta lampe torche (F)
  // (les appels torcheMurale sont volontairement supprimés)

  // ---------- Missions : pied de biche (aile est) puis clé (aile ouest, sous le toit effondré) ----------
  var missionEl = document.getElementById('mission');
  var bossBarEl = document.getElementById('bossBar');
  var bossBarFillEl = document.getElementById('bossBarFill');
  var viseurSniperEl = document.getElementById('viseurSniper');

  // Pied de biche réaliste (acier rouillé) dans l'aile est
  var piedDeBiche = new THREE.Group();
  var lumBiche = new THREE.PointLight(0xff5544, 1.6, 15, 1.6);
  lumBiche.position.y = 0.25;
  // Pilier de lumière rouge au-dessus de l'objet (visible de loin)
  var pilierBiche = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 7, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5544, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  pilierBiche.position.y = 3.5;
  piedDeBiche.add(modelePiedDeBiche(), lumBiche, pilierBiche);
  piedDeBiche.scale.setScalar(1.4);
  piedDeBiche.position.set(66, 0.12, 16);
  piedDeBiche.rotation.y = 0.6;
  scene.add(piedDeBiche);
  var bicheTrouvee = false;

  // Clé rouillée dans l'aile ouest (sous la partie du toit effondrée)
  var cle = new THREE.Group();
  var or = new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.7, roughness: 0.25, emissive: 0xcc9900, emissiveIntensity: 0.9 });
  var anneau = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 8, 16), or);
  var tigeCle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 8), or);
  tigeCle.position.set(0, -0.2, 0);
  var dent1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.03), or);
  dent1.position.set(0.045, -0.33, 0);
  var dent2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), or);
  dent2.position.set(0.03, -0.27, 0);
  // Clé bien cachée : sur la tablette du HAUT de l'étagère du fond de l'aile ouest,
  // sans pilier lumineux — juste une faible lueur qu'il faut repérer à la lampe torche
  var lumCle = new THREE.PointLight(0xffd24a, 0.55, 5, 2);
  lumCle.position.y = 0.15;
  cle.add(anneau, tigeCle, dent1, dent2, lumCle);
  cle.scale.setScalar(1.5);
  cle.position.set(-68, 1.92, -21.8); // étagère du fond, tablette haute
  cle.rotation.y = 0.8;
  cle.rotation.x = -0.4; // posée à plat, discrète
  scene.add(cle);
  cle.visible = false; // la clé n'apparaît que quand on a déjà le pied de biche
  var cleTrouvee = false;

  // ---------- Inventaire (molette de souris pour défiler) ----------
  var inventaire = []; // { nom, icone, couleur }
  var slotSel = 0;
  var slotsEl = document.getElementById('slots');
  var objSelEl = document.getElementById('objetSelectionne');

  function majInventaire() {
    slotsEl.innerHTML = '';
    for (var i = 0; i < inventaire.length; i++) {
      var d = document.createElement('div');
      d.className = 'slot' + (i === slotSel ? ' sel' : '');
      d.style.borderColor = inventaire[i].couleur;
      d.textContent = inventaire[i].icone;
      slotsEl.appendChild(d);
    }
    objSelEl.textContent = inventaire.length
      ? inventaire[slotSel].nom + ((inventaire[slotSel].nom === 'Pistolet' || inventaire[slotSel].nom === 'Sniper') ? ' — ' + munitions + ' balles' : '')
      : '';
    document.getElementById('inventaire').style.display = inventaire.length ? 'flex' : 'none';
    majObjetEnMain(); // l'objet sélectionné apparaît dans la main
  }

  window.addEventListener('wheel', function (e) {
    if (!enJeu || inventaire.length === 0) return;
    slotSel = (slotSel + (e.deltaY > 0 ? 1 : -1) + inventaire.length) % inventaire.length;
    majInventaire();
  });

  function aObjet(nom) {
    for (var i = 0; i < inventaire.length; i++) if (inventaire[i].nom === nom) return true;
    return false;
  }

  function distance2D(x, z) {
    var dx = pos.x - x, dz = pos.z - z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  // Se cacher / sortir du dessous du lit (touche C, près du lit)
  function basculerCache() {
    if (!enJeu || mort) return;
    if (distance2D(litPos.x, litPos.z) < 5.6) {
      cache = !cache;
      if (cache) {
        // on se glisse sous le lit
        pos.x = litPos.x; pos.z = litPos.z; velY = 0;
      }
    }
  }

  // Interaction avec E : ramasser / utiliser
  // ---------- Tchat / commandes admin ----------
  var chatOuvert = false, adminDebloque = false;
  var CODE_ADMIN = '24680'; // code à 5 chiffres pour déverrouiller /admin
  var chatInputEl = document.getElementById('chatInput');
  var chatLogEl = document.getElementById('chatLog');
  // Lance la partie 2 (école abandonnée) : utilisée par le portail ET par la commande /next
  function demarrerPartie2() {
    partie = 2;
    enAttentePartie2 = false;
    scene.fog.color.setHex(0x0b0616); // brouillard violet de la partie 2
    scene.fog.density = 0.016;
    pos.set(0, 1.62, 336); // entrée sud de l'école
    yaw = 0; pitch = 0; velY = 0;
    MAP_CX = 0; MAP_CZ = 310; // la mini-carte se centre sur l'école
    clearTimeout(respawnTimer); clearInterval(respawnInterval);
    if (monstreMort) { monstreMort = false; pvMonstre = 2; scene.add(monstre); }
    monstrePos.set(0, 0, 292); cibleMonstre.set(0, 0, 292); // le monstre rôde dans l'école
    munitions = 10; majInventaire(); // 10 balles au début de la partie 2
    missionEl.textContent = '🎯 Partie 2 : alimente les 3 boîtiers électriques ⚡ pour ouvrir la porte de sortie (nord) !';
    afficherMsg('🌀 Bienvenue dans la partie 2 : l\'école abandonnée... (+10 balles !)', 5000);
    sonScreamer();
  }
  // Écran de transition "PARTIE 3" (comme le portail) quand on franchit la porte du souterrain
  function entrerDansPartie3() {
    enAttentePartie3 = true;
    if (document.exitPointerLock) document.exitPointerLock();
    enJeu = false;
    var box = overlay.querySelector('.overlay-box');
    box.innerHTML = '<h1>🕯️ PARTIE 3</h1>' +
      '<p>La porte du souterrain t\'a mené plus profond... sous l\'école s\'étendent les <strong>CATACOMBES</strong>.</p>' +
      '<p style="color:#ffd9a0">🎯 Partie 3 : trouve la clé 🔑 des catacombes et ouvre la porte du fond (nord) !</p>' +
      '<p class="clic">Clique pour entrer dans la partie 3</p>';
    overlay.classList.remove('cache');
  }

  // Lance la partie 3 (les catacombes) : utilisée par la porte du souterrain ET par /next
  function demarrerPartie3() {
    partie = 3;
    enAttentePartie2 = false;
    scene.fog.color.setHex(0x0a1410); // brouillard verdâtre des catacombes
    scene.fog.density = 0.02;
    pos.set(0, 1.62, 454); // entrée sud des catacombes
    yaw = 0; pitch = 0; velY = 0;
    MAP_CX = 0; MAP_CZ = 430; // mini-carte centrée sur les catacombes
    clearTimeout(respawnTimer); clearInterval(respawnInterval);
    if (monstreMort) { monstreMort = false; pvMonstre = 2; scene.add(monstre); }
    monstrePos.set(0, 0, 420); cibleMonstre.set(0, 0, 420); // le monstre rôde dans les catacombes
    missionEl.textContent = '🎯 Partie 3 : trouve la clé des catacombes 🔑 puis ouvre la porte du fond (nord) !';
    afficherMsg('🕯️ Bienvenue dans la partie 3 : les catacombes...', 5000);
    sonGrowl();
  }

  // /next : va au CHAPITRE suivant (1 château → 2 école → 2b souterrain → 3 catacombes)
  function chapitreSuivant() {
    if (partie === 1) {
      demarrerPartie2();
      return 'Chapitre 2 : l\'école abandonnée 🏫 (partie 2 lancée, +10 balles)';
    }
    if (partie === 2 && pos.y > -6) {
      pos.set(0, -10.38, 300); velY = 0;
      return 'Chapitre 2b : le souterrain 🕳️ (sous la trappe, y=-12)';
    }
    if (partie === 2) {
      entrerDansPartie3();
      return 'Chapitre 3 : les catacombes 🕯️ (transition...)';
    }
    return 'Déjà au dernier chapitre (les catacombes) — /etape ou /tp pour te déplacer.';
  }
  // Donne les armes manquantes (téléportation admin : on garde/gagne ses armes)
  function donnerArmes() {
    var defs = [ // le sniper n'est PAS donné : il se ramasse sur le carré central du souterrain
      { nom: 'Pied de biche', icone: '🔧', couleur: '#ff5544' },
      { nom: 'Clé rouillée', icone: '🗝️', couleur: '#ffd24a' },
      { nom: 'Pistolet', icone: '🔫', couleur: '#cccccc' }
    ];
    var ajoutes = [];
    defs.forEach(function (d) {
      var deja = false;
      for (var i = 0; i < inventaire.length; i++) if (inventaire[i].nom === d.nom) { deja = true; break; }
      if (!deja) { inventaire.push({ nom: d.nom, icone: d.icone, couleur: d.couleur }); ajoutes.push(d.nom); }
    });
    if (ajoutes.indexOf('Pied de biche') >= 0) { bicheTrouvee = true; if (piedDeBiche.parent) scene.remove(piedDeBiche); }
    if (ajoutes.indexOf('Clé rouillée') >= 0) { cleTrouvee = true; cle.visible = true; }
    if (ajoutes.indexOf('Pistolet') >= 0) pistoletPris = true;
    if (munitions < 10) munitions = 10;
    // Équipe automatiquement l'arme la plus forte (sniper > pistolet) pour qu'elle soit bien en main
    for (var i = inventaire.length - 1; i >= 0; i--) {
      if (inventaire[i].nom === 'Sniper' || inventaire[i].nom === 'Pistolet') { slotSel = i; break; }
    }
    majInventaire();
    return ajoutes;
  }
  function ouvrirChat() { chatOuvert = true; keys = {}; chatInputEl.style.display = 'block'; chatInputEl.value = ''; chatInputEl.focus(); }
  function fermerChat() { chatOuvert = false; chatInputEl.style.display = 'none'; chatInputEl.blur(); }
  function chatMsg(t) {
    var d = document.createElement('div');
    d.textContent = t;
    chatLogEl.appendChild(d);
    while (chatLogEl.children.length > 6) chatLogEl.removeChild(chatLogEl.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 9000);
  }
  // Prochaine étape de la progression selon là où on en est
  function etapeSuivante() {
    if (!bicheTrouvee) return { x: piedDeBiche.position.x, y: 1.62, z: piedDeBiche.position.z, txt: 'le pied de biche (aile est)' };
    if (!cleTrouvee) return { x: cle.position.x, y: 1.62, z: cle.position.z, txt: 'la clé rouillée (aile ouest)' };
    if (!porteOuverte) return { x: 0, y: 1.62, z: DZ + 4, txt: 'la porte du donjon' };
    if (!livrePris) return { x: livre.position.x, y: 1.62, z: livre.position.z, txt: 'le livre du code (donjon)' };
    if (!coffreOuvert) return { x: -18, y: 1.62, z: -56, txt: 'le digicode du coffre (donjon)' };
    if (!pistoletPris) return { x: -18, y: 1.62, z: -56, txt: 'le pistolet (coffre ouest)' };
    if (!cristalPris) return { x: 18, y: 1.62, z: -56, txt: 'le cristal vert (coffre est)' };
    if (!crypteOuverte) return { x: 0, y: 1.62, z: -E + 4, txt: 'la porte de la crypte (nord du donjon)' };
    if (partie === 1 && portailActif && portail) return { x: portail.x, y: 1.62, z: portail.z, txt: 'le portail violet (crypte)' };
    if (partie === 1) return { x: 0, y: 1.62, z: -102, txt: 'le bouton rouge du boss (centre de la crypte)' };
    if (partie === 2 && pos.y > -6 && filsAlimentes < 3) return { x: 8, y: 1.62, z: 300, txt: 'le boîtier électrique n°' + (filsAlimentes + 1) + ' (école)' };
    if (partie === 2 && pos.y > -6) return { x: 0, y: 1.62, z: 286, txt: 'la porte de sortie / la trappe (école)' };
    if (partie === 2 && !sniperPris) return { x: 3.5, y: -10.38, z: 277, txt: 'le sniper sur le carré d\'atterrissage (antichambre)' };
    if (partie === 2) return { x: 0, y: -10.38, z: 305, txt: 'les 5 cibles (centre du souterrain)' };
    if (partie === 3 && !cleCatacombesPrise) return { x: -18.5, y: 1.62, z: 428, txt: 'la clé des catacombes 🔑' };
    if (partie === 3) return { x: 0, y: 1.62, z: 406, txt: 'la porte du fond des catacombes (nord)' };
    return { x: 0, y: 1.62, z: 34, txt: 'le spawn (cour du château)' };
  }
  function envoyerChat() {
    var txt = chatInputEl.value.trim();
    fermerChat();
    if (!txt) return;
    chatMsg('> ' + txt);
    if (txt.indexOf('/admin') === 0) {
      var code = txt.split(/\s+/)[1] || '';
      if (code === CODE_ADMIN) {
        adminDebloque = true;
        chatMsg('🔓 Mode admin déverrouillé ! /next = chapitre suivant, /etape = prochaine étape, /tp x z [y] = téléportation libre, /pos = ta position.');
      } else {
        chatMsg('❌ Code incorrect — il faut un code à 5 chiffres : /admin 12345');
      }
      return;
    }
    if (txt === '/next' || txt === '/chapitre') {
      if (!adminDebloque) { chatMsg('🔒 Réservé aux admins : /admin <code à 5 chiffres>'); return; }
      chatMsg('🌀 ' + chapitreSuivant());
      var a1 = donnerArmes();
      if (a1.length) chatMsg('🧰 Armes : ' + a1.join(', ') + ' (munitions >= 10)');
      return;
    }
    if (txt === '/etape') {
      if (!adminDebloque) { chatMsg('🔒 Réservé aux admins : /admin <code à 5 chiffres>'); return; }
      var e = etapeSuivante();
      pos.set(e.x, e.y, e.z); velY = 0;
      var a2 = donnerArmes();
      chatMsg('🎯 Téléporté à l\'étape : ' + e.txt + (a2.length ? ' — 🧰 ' + a2.join(', ') : ''));
      return;
    }
    if (txt === '/pos') { chatMsg('📍 x=' + pos.x.toFixed(1) + ' y=' + pos.y.toFixed(1) + ' z=' + pos.z.toFixed(1) + ' — partie ' + partie); return; }
    var m = txt.match(/^\/tp\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?$/);
    if (m) {
      if (!adminDebloque) { chatMsg('🔒 Réservé aux admins : /admin <code à 5 chiffres>'); return; }
      var y = m[3] !== undefined ? parseFloat(m[3]) : (pos.y < -6 ? -10.38 : 1.62);
      pos.set(parseFloat(m[1]), y, parseFloat(m[2])); velY = 0;
      var a3 = donnerArmes();
      chatMsg('🌀 Téléporté en x=' + m[1] + ' y=' + y.toFixed(1) + ' z=' + m[2] + (a3.length ? ' — 🧰 ' + a3.join(', ') : ''));
      return;
    }
    chatMsg('❓ Commandes : /admin <code> — puis /next (chapitre suivant), /etape (prochaine étape), /tp x z [y], /pos');
  }

  function interagir() {
    if (!bicheTrouvee && distance2D(piedDeBiche.position.x, piedDeBiche.position.z) < 2.2) {
      bicheTrouvee = true;
      scene.remove(piedDeBiche);
      inventaire.push({ nom: 'Pied de biche', icone: '🔧', couleur: '#ff5544' });
      slotSel = inventaire.length - 1; majInventaire();
      cle.visible = true; // la clé apparaît seulement après le pied de biche
      missionEl.textContent = '🎯 Mission 2 : trouver une clé pour ouvrir une porte';
      return;
    }
    if (!cleTrouvee && bicheTrouvee && distance2D(cle.position.x, cle.position.z) < 4.4) {
      cleTrouvee = true;
      scene.remove(cle);
      inventaire.push({ nom: 'Clé rouillée', icone: '🗝️', couleur: '#ffd24a' });
      slotSel = inventaire.length - 1; majInventaire();
      missionEl.textContent = '🎯 Mission 3 : ouvre la porte verrouillée du donjon (E près de la porte)';
      return;
    }
    if (!livrePris && distance2D(livre.position.x, livre.position.z) < 4.8) {
      livrePris = true;
      scene.remove(livre);
      inventaire.push({ nom: 'Livre du code (7-3-9-2)', icone: '📖', couleur: '#ffee66' });
      slotSel = inventaire.length - 1; majInventaire();
      missionEl.textContent = '🎯 Mission 5 : utilise le code 7-3-9-2 sur le coffre du donjon';
      return;
    }
    // Fouiller une caisse de munitions (+2 balles)
    for (var cm = 0; cm < conteneursMunitions.length; cm++) {
      var ct = conteneursMunitions[cm];
      if (!ct.pris && distance2D(ct.x, ct.z) < 3) {
        ct.pris = true;
        scene.remove(ct.marqueur);
        munitions = Math.min(20, munitions + 2);
        majInventaire();
        afficherMsg('+2 balles ! (' + munitions + ' au total)', 2000);
        return;
      }
    }
    // Prendre le cristal vert dans le coffre EST
    if (coffre2Ouvert && !cristalPris && distance2D(18, -60) < 3.5) {
      cristalPris = true;
      coffre2.remove(cleSortie);
      inventaire.push({ nom: 'Cristal vert', icone: '💚', couleur: '#66ff88' });
      slotSel = inventaire.length - 1; majInventaire();
      missionEl.textContent = '🎯 Mission 8 : ouvre la porte de la crypte (nord du donjon) avec le cristal';
      return;
    }
    // Ouvrir la porte de la crypte avec le cristal
    if (!crypteOuverte && aObjet('Cristal vert') && distance2D(0, -E) < 5.2) {
      crypteOuverte = true; crypteEnCours = true;
      missionEl.textContent = '🎯 Mission 8 : appuie sur le bouton rouge au centre de la crypte !';
      return;
    }
    // Bouton au centre de la crypte : fait apparaître le boss
    if (crypteOuverte && !bossApparu && distance2D(0, -102) < 4.5) {
      bossApparu = true;
      boss.visible = true;
      sonScreamer(); sonGrowl(); startMusiquePeur();
      missionEl.textContent = '🎯 Mission 9 : tue le boss de la crypte ! (pistolet ou pied de biche)';
      afficherMsg('☠ LE BOSS APPARAÎT DANS LA CRYPTE !', 3000);
      return;
    }
    // Partie 2 : alimenter un boîtier électrique de l'école avec E
    if (partie === 2 && !enAttentePartie2) {
      for (var bi = 0; bi < boitiersElec.length; bi++) {
        var bo = boitiersElec[bi];
        if (!bo.alimente && distance2D(bo.x, bo.z) < 3.8) {
          bo.alimente = true;
          bo.lampe.material.color.setHex(0x2bff6a); // la lampe passe au vert
          alimenterFils();
          return;
        }
      }
    }
    // Partie 2, souterrain : ouvrir la porte de l'antichambre (E)
    if (partie === 2 && pos.y < -6 && !porteEntreeOuverte && distance2D(0, 281) < 8) {
      porteEntreeOuverte = true; porteEntreeEnCours = true;
      sonCoup();
      return;
    }
    // Partie 3, catacombes : prendre la clé dorée
    if (partie === 3 && !cleCatacombesPrise && distance2D(-18.5, 428) < 3.5) {
      cleCatacombesPrise = true;
      scene.remove(cleCatacombes);
      inventaire.push({ nom: 'Clé des catacombes', icone: '🔑', couleur: '#ffd24a' });
      slotSel = inventaire.length - 1; majInventaire();
      missionEl.textContent = '🎯 Partie 3 : ouvre la porte du fond (nord) avec la clé 🔑 !';
      afficherMsg('🔑 Clé des catacombes prise ! Va à la porte du fond (nord)', 4000);
      return;
    }
    // Partie 3, catacombes : ouvrir la porte du fond avec la clé
    if (partie === 3 && !porteCatacombesOuverte && distance2D(0, 402) < 4.5) {
      if (aObjet('Clé des catacombes')) {
        porteCatacombesOuverte = true; porteCatacombesEnCours = true;
        porteCatacombes.userData.lampe.material.color.setHex(0x2bff6a);
        sonCoup();
        afficherMsg('🚪 La porte des catacombes s\'ouvre...', 4000);
      } else {
        sonClicVide();
        afficherMsg('🔒 Porte verrouillée — il te faut la clé des catacombes 🔑', 2500);
      }
      return;
    }
    // Partie 2, souterrain : prendre le sniper sur le carré central
    if (partie === 2 && !enAttentePartie2 && !sniperPris && pos.y < -6 && distance2D(3.5, 277) < 3.5) {
      sniperPris = true;
      scene.remove(sniperMesh);
      inventaire.push({ nom: 'Sniper', icone: '🎯', couleur: '#9adcff' });
      slotSel = inventaire.length - 1; majInventaire();
      munitions = Math.min(20, munitions + 15);
      missionEl.textContent = '🎯 Partie 2 : touche les 5 cibles avec le sniper ! (0/5)';
      afficherMsg('🎯 Sniper pris ! +15 balles — vise les 5 cibles !', 4000);
      return;
    }
    // Mission 5 : digicode du coffre (nécessite le livre)
    if (!coffreOuvert && distance2D(-18, -60) < 3.5) {
      if (aObjet('Livre du code (7-3-9-2)')) { ouvrirDigicode(); return; }
      // sinon la porte reste verrouillée
    }
    // Mission 6 : prendre le pistolet DANS le coffre ouvert
    if (!pistoletPris && coffreOuvert && distance2D(-18, -60) < 3.5) {
      pistoletPris = true;
      coffre.remove(pistolet);
      munitions = Math.min(20, munitions + 5); // les 5 balles du pistolet S'AJOUTENT à celles déjà ramassées
      inventaire.push({ nom: 'Pistolet', icone: '🔫', couleur: '#aaaaaa' });
      slotSel = inventaire.length - 1; majInventaire();
      missionEl.textContent = '🎯 Mission 7 : tue le monstre avec le pistolet (clic gauche) !';
      return;
    }
    if (!porteOuverte && aObjet('Clé rouillée') && distance2D(0, DZ) < 5.2) {
      porteOuverte = true; porteEnCours = true;
      // La suite de l'histoire : le zombie se poste à l'intérieur du donjon et accélère
      if (!monstreMort) { monstrePos.set(0, 0, -66); cibleMonstre.set(0, 0, -66); }
      missionEl.textContent = '🎯 Mission 4 : entre dans le donjon et trouve le livre avec le code';
      // La clé est consommée : elle disparaît de l'inventaire et de la main
      for (var i = inventaire.length - 1; i >= 0; i--) {
        if (inventaire[i].nom === 'Clé rouillée') inventaire.splice(i, 1);
      }
      slotSel = Math.max(0, Math.min(slotSel, inventaire.length - 1));
      majInventaire();
      missionEl.textContent = '✔ Porte du donjon ouverte — explore !';
      missionEl.classList.add('accomplie');
    }
  }

  // ---------- Le monstre (zombie modifié) ----------
  function texGlow() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,70,70,0.95)');
    grad.addColorStop(0.4, 'rgba(255,30,30,0.35)');
    grad.addColorStop(1, 'rgba(255,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  var glowTex = texGlow();

  // Peau de zombie HD : pores, marbrures, contusions, veines, plaies ouvertes, sang séché
  function texZombie() {
    var S = 256;
    var c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d');
    g.fillStyle = 'rgb(122,126,106)'; g.fillRect(0, 0, S, S);
    var i;
    for (i = 0; i < 2600; i++) { // pores et grain de peau
      var v = Math.random();
      g.fillStyle = v < 0.5 ? 'rgba(90,95,75,' + (Math.random() * 0.22) + ')' : 'rgba(160,165,145,' + (Math.random() * 0.18) + ')';
      g.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    for (i = 0; i < 40; i++) { // marbrures (zones plus pâles/verdâtres)
      g.fillStyle = Math.random() < 0.5 ? 'rgba(100,115,85,0.16)' : 'rgba(150,150,135,0.14)';
      g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 6 + Math.random() * 22, 0, Math.PI * 2); g.fill();
    }
    for (i = 0; i < 12; i++) { // contusions violettes
      g.fillStyle = 'rgba(90,70,120,' + (0.12 + Math.random() * 0.15) + ')';
      g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 4 + Math.random() * 12, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(45,70,45,0.55)'; g.lineWidth = 1; // veines saillantes
    for (i = 0; i < 14; i++) {
      g.beginPath(); var vx = Math.random() * S, vy = Math.random() * S;
      g.moveTo(vx, vy);
      for (var s = 0; s < 5; s++) { vx += (Math.random() - 0.5) * 30; vy += (Math.random() - 0.5) * 30; g.lineTo(vx, vy); }
      g.stroke();
    }
    for (i = 0; i < 6; i++) { // plaies ouvertes : bord rouge, centre sombre, caillot
      var px = Math.random() * S, py = Math.random() * S, pr = 4 + Math.random() * 9;
      g.fillStyle = 'rgba(150,30,25,0.7)';
      g.beginPath(); g.arc(px, py, pr + 2.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(95,10,10,0.95)';
      g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(50,5,5,0.9)';
      g.beginPath(); g.arc(px, py, pr * 0.45, 0, Math.PI * 2); g.fill();
      // coulure de sang
      g.strokeStyle = 'rgba(120,15,12,0.8)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px, py + pr); g.lineTo(px + (Math.random() - 0.5) * 6, py + pr + 8 + Math.random() * 14); g.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  // Chemise déchirée avec taches de sang séché
  function texShirt() {
    var S = 256;
    var c = document.createElement('canvas'); c.width = c.height = S;
    var g = c.getContext('2d');
    g.fillStyle = 'rgb(99,66,53)'; g.fillRect(0, 0, S, S);
    bruitCanvas(g, 500, 0.14, '0,0,0');
    bruitCanvas(g, 200, 0.1, '255,240,220');
    var i;
    for (i = 0; i < 10; i++) { // taches de sang
      g.fillStyle = 'rgba(105,15,12,' + (0.35 + Math.random() * 0.4) + ')';
      g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 3 + Math.random() * 12, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(60,8,6,0.5)';
      g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 5, 0, Math.PI * 2); g.fill();
    }
    for (i = 0; i < 10; i++) { // déchirures (bord effiloché)
      var hx = Math.random() * S, hy = Math.random() * S;
      g.fillStyle = 'rgba(10,7,5,0.95)';
      g.beginPath();
      for (var p = 0; p < 7; p++) g.lineTo(hx + (Math.random() - 0.5) * 34, hy + (Math.random() - 0.5) * 34);
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(150,120,100,0.6)'; g.lineWidth = 1.5; g.stroke();
    }
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  var monstre = new THREE.Group();
  var matPeau = new THREE.MeshStandardMaterial({ map: texZombie(), roughness: 0.8 });
  var matShirt = new THREE.MeshStandardMaterial({ map: texShirt(), roughness: 1 });
  var matPantalon = new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 1 });
  var matYeux = new THREE.MeshBasicMaterial({ color: 0xff2222 });

  // Jambes (pivot à la hanche pour la démarche)
  function jambe(x) {
    var g = new THREE.Group();
    var cuisse = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.5, 7), matPantalon);
    cuisse.position.y = -0.25;
    var mollet = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.45, 7), matPantalon);
    mollet.position.y = -0.72;
    var pied = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.24), matPantalon);
    pied.position.set(0, -0.95, -0.06);
    g.add(cuisse, mollet, pied);
    g.position.set(x, 0.95, 0);
    return g;
  }
  var jambeG = jambe(-0.13);
  var jambeD = jambe(0.13);

  // Torse voûté (zombie penché en avant) en chemise déchirée
  var torse = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.85, 9), matShirt);
  torse.position.y = 1.38; torse.rotation.x = 0.32; torse.castShadow = true;

  // Tête réaliste : crâne + nez + mâchoire + oreilles, peau zombie
  var teteM = new THREE.Mesh(new THREE.SphereGeometry(0.23, 24, 24), matPeau);
  teteM.position.set(0, 1.98, -0.22); teteM.scale.set(0.92, 1.08, 0.98); teteM.rotation.x = 0.35; teteM.castShadow = true;
  var nez = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 8), matPeau);
  nez.position.set(0, 1.93, -0.44); nez.rotation.x = Math.PI / 2 + 0.3;
  var machoireM = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.16), matPeau);
  machoireM.position.set(0, 1.84, -0.36); machoireM.rotation.x = 0.4; // mâchoire entrouverte
  var bouche = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.1), new THREE.MeshStandardMaterial({ color: 0x0a0505, roughness: 1 }));
  bouche.position.set(0, 1.87, -0.42);
  var dents = new THREE.Group();
  for (var d = 0; d < 5; d++) {
    var dent = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.02), new THREE.MeshStandardMaterial({ color: 0xcfc9b4, roughness: 0.5 }));
    dent.position.set(-0.08 + d * 0.04, 1.905, -0.46);
    dents.add(dent);
  }
  var oreilleG = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), matPeau);
  oreilleG.position.set(-0.22, 2.0, -0.2); oreilleG.scale.set(0.5, 1, 0.7);
  var oreilleD = oreilleG.clone(); oreilleD.position.x = 0.22;
  // Yeux réalistes : globe blanc + iris + pupille ; droite = rouge vif + halo
  function oeil(x, y, z, irisColor) {
    var g = new THREE.Group();
    var globe = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 12), new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.35 }));
    var iris = new THREE.Mesh(new THREE.CircleGeometry(0.026, 12), new THREE.MeshBasicMaterial({ color: irisColor }));
    iris.position.z = 0.042;
    var pupille = new THREE.Mesh(new THREE.CircleGeometry(0.011, 8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    pupille.position.z = 0.045;
    g.add(globe, iris, pupille);
    g.position.set(x, y, z);
    return g;
  }
  var oeilG = oeil(-0.09, 2.03, -0.42, 0x5a6a4a);  // iris verdâtre (œil mort)
  var oeilD = oeil(0.09, 2.04, -0.42, 0xff2222);   // iris rouge vif
  oeilD.children[1].material = matYeux; // l'iris droit brille
  var haloD = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  haloD.position.set(0.09, 2.04, -0.38); haloD.scale.set(0.55, 0.55, 1);

  // Bras tendus vers l'avant (allure de zombie), avec doigts
  function bras(x) {
    var g = new THREE.Group();
    var haut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.6, 8), matPeau);
    haut.position.y = -0.3; haut.castShadow = true;
    var avant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.55, 8), matPeau);
    avant.position.y = -0.85; avant.rotation.x = -0.15; avant.castShadow = true;
    var main = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), matPeau);
    main.position.y = -1.14; main.scale.set(0.9, 1.1, 1.2);
    g.add(haut, avant, main);
    for (var f = 0; f < 4; f++) { // doigts griffus
      var doigt = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.14, 5), matPeau);
      doigt.position.set((f - 1.5) * 0.028, -1.24, -0.05);
      doigt.rotation.x = -0.4;
      g.add(doigt);
    }
    g.position.set(x, 1.62, -0.1);
    g.rotation.x = -1.35; // tendu devant
    return g;
  }
  var brasMG = bras(-0.27);
  var brasMD = bras(0.27);

  var lumRouge = new THREE.PointLight(0xff2222, 1.0, 10, 2);
  lumRouge.position.set(0.1, 2.0, -0.3);

  monstre.add(jambeG, jambeD, torse, teteM, nez, machoireM, bouche, dents, oreilleG, oreilleD, oeilG, oeilD, haloD, brasMG, brasMD, lumRouge);
  // Ombre portée au sol (blob shadow) pour bien l'ancrer dans la scène
  var blobTex = (function () {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  var blob = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02;
  monstre.add(blob);
  monstre.position.set(50, 0, 30); // erre dans la cour au départ
  scene.add(monstre);

  // Le boss de la crypte (clone du zombie en géant, caché au début)
  var boss = monstre.clone(true);
  boss.scale.setScalar(1.45);
  boss.position.set(0, 0, -112);
  boss.visible = false;
  scene.add(boss);
  var bossPos = boss.position;
  var bossPV = 12, bossPVMax = 12, bossMort = false; // le boss a beaucoup plus de vie
  var bossApparu = false; // le boss n'apparaît que quand on appuie sur le bouton central
  var monstrePos = monstre.position;
  var cibleMonstre = new THREE.Vector3(50, 0, 30);
  var poursuit = false;
  var mort = false;
  var pvMonstre = 2;        // 2 coups de pied de biche = mort
  var monstreMort = false;
  var stunT = 0;            // le monstre est étourdi après un coup
  var hitFlash = 0;         // flash blanc quand il prend un coup
  var stuckT = 0;           // temps bloqué contre un mur → détour

  function sonMortMonstre() {
    if (!audioCtx) return;
    try {
      var o = audioCtx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(160, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 1.2);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.3, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);
      var f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      o.connect(f); f.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 1.2);
    } catch (e) { /* pas de son */ }
  }

  var respawnTimer = null, respawnInterval = null;
  var msgMonstreEl = document.getElementById('msgMonstre');
  var msgTimer = null;

  // Message temporaire du monstre (n'écrase PAS l'objectif de mission)
  function afficherMsg(txt, duree) {
    msgMonstreEl.textContent = txt;
    msgMonstreEl.style.display = 'block';
    if (msgTimer) clearTimeout(msgTimer);
    if (duree) msgTimer = setTimeout(function () { msgMonstreEl.style.display = 'none'; }, duree);
  }

  function tuerMonstre() {
    monstreMort = true;
    poursuit = false;      // il ne poursuit plus
    stopMusiquePeur();     // la musique d'angoisse s'arrête
    scene.remove(monstre);
    sonMortMonstre();
    // Compte à rebours de 15 s dans la ligne de message dédiée
    var reste = 15;
    afficherMsg('✔ Le monstre est détruit ! Il réapparaît dans ' + reste + ' s...', 0);
    respawnInterval = setInterval(function () {
      reste--;
      if (reste > 0) msgMonstreEl.textContent = '✔ Le monstre est détruit ! Il réapparaît dans ' + reste + ' s...';
    }, 1000);
    respawnTimer = setTimeout(respawnMonstre, 15000);
    // PAS de portail ici : le portail de fin de partie 1 n'apparaît que quand le BOSS de la crypte meurt
  }

  function respawnMonstre() {
    if (mort) return; // pas de réapparition si le joueur est mort
    clearInterval(respawnInterval);
    monstreMort = false; pvMonstre = 2; stunT = 0; hitFlash = 0;
    // Il réapparaît à 25 m du joueur, dans une direction aléatoire
    var a = Math.random() * Math.PI * 2;
    monstrePos.set(pos.x + Math.cos(a) * 50, 0, pos.z + Math.sin(a) * 50);
    pousserCollisions(monstrePos, 0.5);
    if (partie === 1 || enAttentePartie2) {
      monstrePos.x = Math.max(-100, Math.min(100, monstrePos.x));
      monstrePos.z = Math.max(-100, Math.min(100, monstrePos.z));
    } else if (partie === 3) {
      monstrePos.x = Math.max(-18, Math.min(18, monstrePos.x));
      monstrePos.z = Math.max(404, Math.min(456, monstrePos.z));
    } else {
      monstrePos.x = Math.max(-28, Math.min(28, monstrePos.x));
      monstrePos.z = Math.max(282, Math.min(338, monstrePos.z));
    }
    cibleMonstre.set(monstrePos.x, 0, monstrePos.z);
    scene.add(monstre);
    sonGrowl();
    afficherMsg('⚠ Le monstre est revenu !', 5000); // disparaît après 5 s, l'objectif reste affiché
  }

  // ---------- Portail de fin de partie 1 ----------
  var portail = null, portailActif = false, portailT = 0;
  function creerPortail(x, z) {
    var g = new THREE.Group();
    g.position.set(x, 0, z);
    var anneau = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.18, 12, 48),
      new THREE.MeshStandardMaterial({ color: 0x8a4dff, emissive: 0x6a2bff, emissiveIntensity: 1.3, roughness: 0.3 }));
    anneau.position.y = 2.7;
    var disque = new THREE.Mesh(new THREE.CircleGeometry(2.05, 48),
      new THREE.MeshBasicMaterial({ color: 0xc07bff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    disque.position.y = 2.7;
    var lum = new THREE.PointLight(0x8a4dff, 1.4, 20, 1.8);
    lum.position.y = 3.2;
    g.add(anneau, disque, lum);
    scene.add(g);
    portail = { g: g, anneau: anneau, disque: disque, lum: lum, x: x, z: z };
  }

  // Mission affichée en partie 2 selon la progression déjà faite
  function texteMissionActuelle() {
    if (!bicheTrouvee) return '🎯 Partie 2 — Mission 1 : trouve un pied de biche (aile est)';
    if (!cleTrouvee) return '🎯 Partie 2 — Mission 2 : trouve la clé rouillée (aile ouest, en haut de l\'étagère)';
    if (!porteOuverte) return '🎯 Partie 2 — Mission 3 : ouvre la porte du donjon avec la clé';
    if (!livrePris) return '🎯 Partie 2 — Mission 4 : trouve le livre du code dans le donjon';
    if (!coffreOuvert) return '🎯 Partie 2 — Mission 5 : entre le code du livre sur le digicode du coffre';
    if (!pistoletPris || !cristalPris) return '🎯 Partie 2 — Mission 6 : prends le pistolet et le cristal vert dans les deux coffres';
    if (!crypteOuverte) return '🎯 Partie 2 — Mission 8 : ouvre la porte de la crypte avec le cristal 💚';
    if (!bossApparu) return '🎯 Partie 2 — Mission 8 : appuie sur le bouton rouge au centre de la crypte !';
    if (!bossMort) return '🎯 Partie 2 — Mission 9 : tue le boss de la crypte !';
    return '🎯 Partie 2 — Mission 10 : sors du château par la poterne sud !';
  }

  function entrerDansPortail() {
    partie = 2;
    portailActif = false;
    if (portail) { scene.remove(portail.g); portail = null; }
    if (document.exitPointerLock) document.exitPointerLock();
    enJeu = false;
    enAttentePartie2 = true;
    var box = overlay.querySelector('.overlay-box');
    box.innerHTML = '<h1>🌀 PARTIE 2</h1>' +
      '<p>Le portail t\'a aspiré... Tu te retrouves dans la cour du château, mais <strong>tout est différent</strong> : le brouillard est devenu violet et une présence plus ancienne rôde dans les ombres.</p>' +
      '<p style="color:#d9b8ff">' + texteMissionActuelle() + '</p>' +
      '<p class="clic">Clique pour entrer dans la partie 2</p>';
    overlay.classList.remove('cache');
  }

  // Screamer : cri strident (oscillateur qui descend + bruit blanc violent)
  function sonScreamer() {
    if (!audioCtx) return;
    try {
      var duree = 1.1;
      // bruit blanc violent
      var buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * duree, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < data.length; i++) {
        var env = 1 - i / data.length;
        data[i] = (Math.random() * 2 - 1) * env * env;
      }
      var src = audioCtx.createBufferSource(); src.buffer = buffer;
      var hp = audioCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 800;
      var g = audioCtx.createGain(); g.gain.value = 0.95;
      src.connect(hp); hp.connect(g); g.connect(audioCtx.destination);
      src.start();
      // cri aigu qui descend
      var o = audioCtx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(1400, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + duree);
      var g2 = audioCtx.createGain();
      g2.gain.setValueAtTime(0.7, audioCtx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duree);
      var bp = audioCtx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 2;
      o.connect(bp); bp.connect(g2); g2.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + duree);
    } catch (e) { /* pas de son */ }
  }

  // ---------- Musique d'angoisse quand le monstre poursuit ----------
  var musiquePeur = null; // { gain, oscs[] }
  function startMusiquePeur() {
    if (!audioCtx || musiquePeur) return;
    try {
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.09, audioCtx.currentTime + 0.6);
      var f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      // cluster dissonant : graves désaccordés + seconde mineure aiguë
      var freqs = [55, 58.27, 110.3, 220, 233.08];
      var oscs = [];
      freqs.forEach(function (fr) {
        var o = audioCtx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr;
        o.connect(f); o.start();
        oscs.push(o);
      });
      // trémolo lent sur le volume
      var lfo = audioCtx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.13;
      var lfoG = audioCtx.createGain(); lfoG.gain.value = 0.03;
      lfo.connect(lfoG); lfoG.connect(g.gain); lfo.start();
      oscs.push(lfo);
      f.connect(g); g.connect(audioCtx.destination);
      musiquePeur = { gain: g, oscs: oscs };
    } catch (e) { /* pas de son */ }
  }
  function stopMusiquePeur() {
    if (!musiquePeur || !audioCtx) return;
    try {
      var m = musiquePeur; musiquePeur = null;
      m.gain.gain.cancelScheduledValues(audioCtx.currentTime);
      m.gain.gain.setValueAtTime(m.gain.gain.value, audioCtx.currentTime);
      m.gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.8);
      setTimeout(function () { m.oscs.forEach(function (o) { try { o.stop(); } catch (e) {} }); }, 900);
    } catch (e) { /* pas de son */ }
  }

  function sonGrowl() {
    if (!audioCtx) return;
    try {
      var o = audioCtx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
      var o2 = audioCtx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 58;
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.1);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.9);
      var f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(audioCtx.destination);
      o.start(); o2.start(); o.stop(audioCtx.currentTime + 0.9); o2.stop(audioCtx.currentTime + 0.9);
    } catch (e) { /* pas de son */ }
  }

  function gameOver() {
    mort = true;
    if (document.exitPointerLock) document.exitPointerLock();
    enJeu = false;
    var box = overlay.querySelector('.overlay-box');
    box.innerHTML = '<h1>☠ Attrapé</h1><p>Les yeux rouges se sont posés sur toi dans le château...</p><p class="clic">Clique pour recommencer</p>';
    overlay.classList.remove('cache');
  }

  // ---------- Mission 4 : le livre avec le code (dans le donjon) ----------
  var livrePris = false;
  var livre = new THREE.Group();
  // Couverture du livre avec le CODE écrit dessus (texture procédurale)
  var texCode = (function () {
    var c = document.createElement('canvas'); c.width = 128; c.height = 160;
    var g = c.getContext('2d');
    g.fillStyle = 'rgb(80,18,18)'; g.fillRect(0, 0, 128, 160);       // cuir rouge sombre
    g.strokeStyle = 'rgb(200,170,90)'; g.lineWidth = 4; g.strokeRect(8, 8, 112, 144); // dorure
    g.fillStyle = 'rgb(230,220,190)';
    g.font = 'bold 44px "Courier New", monospace';
    g.textAlign = 'center';
    g.fillText('7-3-9-2', 64, 88);                                     // le code
    var t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  })();
  var couverture = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 1.5),
    new THREE.MeshStandardMaterial({ map: texCode, roughness: 0.7 }));
  var pages = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 1 }));
  pages.position.y = -0.1;
  var lumLivre = new THREE.PointLight(0xffee66, 1.5, 26, 1.8);
  lumLivre.position.y = 0.9;
  var pilierLivre = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffee66, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  pilierLivre.position.y = 6;
  livre.add(couverture, pages, lumLivre, pilierLivre);
  livre.position.set(0, 0.95, -60); // sur la grande table du donjon
  livre.rotation.y = 0.4;
  scene.add(livre);

  // Coffre verrouillé du donjon (s'ouvre avec le code du livre)
  var coffre = new THREE.Group();
  var baseCoffre = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.0), bois);
  baseCoffre.position.y = 0.45; baseCoffre.castShadow = true; baseCoffre.receiveShadow = true;
  var pivotCouvercle = new THREE.Group();
  pivotCouvercle.position.set(0, 0.9, 0.5);
  var couvercle = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.0), boisClair);
  couvercle.position.set(0, 0.15, -0.5); couvercle.castShadow = true;
  pivotCouvercle.add(couvercle);
  var serrureCoffre = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.9, roughness: 0.3 }));
  serrureCoffre.position.set(0, 0.5, -0.52);
  var lumCoffre = new THREE.PointLight(0xffd24a, 0.7, 14, 1.8); // lueur dorée permanente : on voit le coffre
  lumCoffre.position.set(0, 1.2, 0);
  var pilierCoffre = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  pilierCoffre.position.y = 5;
  var cleSortie = new THREE.Mesh(new THREE.OctahedronGeometry(0.18),
    new THREE.MeshStandardMaterial({ color: 0x66ff88, emissive: 0x22cc55, emissiveIntensity: 1.5, roughness: 0.2 }));
  cleSortie.position.set(0, 0.65, 0); cleSortie.visible = false;
  coffre.add(baseCoffre, pivotCouvercle, serrureCoffre, lumCoffre, pilierCoffre);
  coffre.position.set(-18, 0, -60); // coffre OUEST : contient le pistolet
  scene.add(coffre);
  cercles.push({ x: -18, z: -60, r: 1.2 });

  // Deuxième coffre (EST du donjon) : contient le cristal vert
  var coffre2 = new THREE.Group();
  var baseCoffre2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.0), bois);
  baseCoffre2.position.y = 0.45; baseCoffre2.castShadow = true; baseCoffre2.receiveShadow = true;
  var pivotCouvercle2 = new THREE.Group();
  pivotCouvercle2.position.set(0, 0.9, 0.5);
  var couvercle2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.0), boisClair);
  couvercle2.position.set(0, 0.15, -0.5); couvercle2.castShadow = true;
  pivotCouvercle2.add(couvercle2);
  var serrureCoffre2 = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x66ff88, metalness: 0.9, roughness: 0.3, emissive: 0x114422 }));
  serrureCoffre2.position.set(0, 0.5, -0.52);
  var lumCoffre2 = new THREE.PointLight(0xffd24a, 0.7, 14, 1.8);
  lumCoffre2.position.set(0, 1.2, 0);
  var pilierCoffre2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
  pilierCoffre2.position.y = 5;
  coffre2.add(baseCoffre2, pivotCouvercle2, serrureCoffre2, lumCoffre2, pilierCoffre2, cleSortie);
  coffre2.position.set(18, 0, -60); // coffre EST : contient le cristal
  scene.add(coffre2);
  cercles.push({ x: 18, z: -60, r: 1.2 });
  var coffre2Ouvert = false, coffre2EnCours = false;
  var coffreOuvert = false, coffreEnCours = false;
  var cristalPris = false;

  // ---------- Pistolet (mission 6 : apparaît quand le coffre est ouvert) ----------
  var pistoletPris = false;
  var pistolet = modelePistolet();
  var lumPistolet = new THREE.PointLight(0xbbbbbb, 0.8, 8, 2);
  lumPistolet.position.y = 0.3;
  pistolet.add(lumPistolet);
  pistolet.position.set(0, 0.55, 0); // DANS le coffre
  pistolet.visible = false; // caché tant que le coffre n'est pas ouvert
  coffre.add(pistolet);
  var munitions = 0; // 5 balles au départ

  // Clic à vide (plus de munitions)
  function sonClicVide() {
    if (!audioCtx) return;
    try {
      var o = audioCtx.createOscillator(); o.type = 'square'; o.frequency.value = 900;
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.12, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.06);
    } catch (e) { /* pas de son */ }
  }

  // Bzzzt électrique (boîtier alimenté)
  function sonZap() {
    if (!audioCtx) return;
    try {
      var o = audioCtx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(1200, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.25);
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.22, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.3);
    } catch (e) { /* pas de son */ }
  }

  // Son de tir
  function sonTir() {
    if (!audioCtx) return;
    try {
      var buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.25, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      var src = audioCtx.createBufferSource(); src.buffer = buffer;
      var f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
      var g = audioCtx.createGain(); g.gain.value = 0.6;
      src.connect(f); f.connect(g); g.connect(audioCtx.destination); src.start();
      var o = audioCtx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(160, audioCtx.currentTime);
      o.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);
      var g2 = audioCtx.createGain();
      g2.gain.setValueAtTime(0.5, audioCtx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      o.connect(g2); g2.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + 0.2);
    } catch (e) { /* pas de son */ }
  }

  var startTime = null;
  var partieGagnee = false;
  function gagner() {
    partieGagnee = true;
    if (document.exitPointerLock) document.exitPointerLock();
    enJeu = false;
    var sec = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
    var box = overlay.querySelector('.overlay-box');
    box.innerHTML = '<h1>🌅 Échappé !</h1><p>Code <strong>7-3-9-2</strong> entré, coffre ouvert, poterne franchie — tu t\'échappes du château dans la nuit...</p><p>Temps de partie : ' + Math.floor(sec / 60) + ' min ' + (sec % 60) + ' s</p><p class="clic">Clique pour rejouer</p>';
    overlay.classList.remove('cache');
  }

  function gagnerPartie2() {
    partieGagnee = true;
    if (document.exitPointerLock) document.exitPointerLock();
    enJeu = false;
    var box = overlay.querySelector('.overlay-box');
    box.innerHTML = '<h1>🏫 Partie 2 terminée !</h1><p>École abandonnée, trappe dans le sol, souterrain, 5 cibles au sniper... Tu as tout traversé. Bravo !</p><p class="clic">Clique pour rejouer</p>';
    overlay.classList.remove('cache');
  }

  function gagnerPartie3() {
    partieGagnee = true;
    if (document.exitPointerLock) document.exitPointerLock();
    enJeu = false;
    var box = overlay.querySelector('.overlay-box');
    box.innerHTML = '<h1>🏆 BRAVO, TU AS TOUT TERMINÉ !</h1><p>Château hanté, école abandonnée, souterrain au sniper, catacombes... Tu t\'échappes ENFIN dans la nuit. 🎉</p><p class="clic">Clique pour rejouer</p>';
    overlay.classList.remove('cache');
  }

  // ---------- PARTIE 2 : l'école abandonnée (au nord, z 280..340, hors du château) ----------
  var lumieresEcole = [];
  var boitiersElec = [];       // 3 boîtiers électriques à alimenter pour ouvrir la porte de sortie
  var filsAlimentes = 0;
  var porteSortie = null, rectPorteSortie = null, porteSortieEnCours = false, porteSortieOuverte = false;
  var trappeOuverte = false, trappeEnCours = false, pivotTrappe = null, rectTrappe = null, chuteMsg = false;
  var cibles = [], ciblesTouchees = 0;   // 5 cibles rouges du souterrain
  var sniperPris = false, sniperMesh = null;
  var porteSouterrain = null, rectPorteSouterrain = null, porteSouterrainEnCours = false;
  var porteEntree = null, rectPorteEntree = null, porteEntreeOuverte = false, porteEntreeEnCours = false;
  var barrierePorte = null, rectBarrierePorte = null, barriereBaisseEnCours = false;
  var barrieres = [], barrieresBaissent = false; // barrières basses du souterrain (s'enfoncent à 5/5)
  // ---------- PARTIE 3 : les catacombes ----------
  var cleCatacombes = null, cleCatacombesPrise = false;
  var porteCatacombes = null, rectPorteCatacombes = null, porteCatacombesOuverte = false, porteCatacombesEnCours = false;
  var porteCassee = false, porteAileOuest = null, rectPorteAileOuest = null, porteAileOuestCasseT = 0;
  function boitierProche() {
    for (var i = 0; i < boitiersElec.length; i++) {
      var b = boitiersElec[i];
      if (!b.alimente && distance2D(b.x, b.z) < 3.8) return true;
    }
    return false;
  }
  function alimenterFils() {
    filsAlimentes++;
    sonZap();
    if (filsAlimentes >= 3) {
      porteSortieEnCours = true;
      porteSortie.userData.lampe.material.color.setHex(0x2bff6a); // lampe de la porte au vert
      missionEl.textContent = '🚪 Porte alimentée — sors par la porte du fond (nord) !';
      afficherMsg('⚡ Les 3 fils sont alimentés : LA PORTE S\'OUVRE !', 5000);
    } else {
      afficherMsg('⚡ Fil électrique alimenté ! (' + filsAlimentes + '/3)', 3000);
      missionEl.textContent = '⚡ Partie 2 : ' + filsAlimentes + '/3 fils alimentés — encore ' + (3 - filsAlimentes) + ' boîtier(s) à trouver !';
    }
  }
  (function construireEcole() {
    // plâtre clair fissuré (murs de l'école)
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#8f8a80'; g.fillRect(0, 0, 128, 128);
    for (var i = 0; i < 1200; i++) {
      g.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '40,38,34' : '195,190,180') + ',' + (Math.random() * 0.12) + ')';
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    g.strokeStyle = 'rgba(40,38,34,0.45)'; g.lineWidth = 1;
    for (var f = 0; f < 7; f++) {
      var fx = Math.random() * 128, fy = Math.random() * 128;
      g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + Math.random() * 36 - 18, fy + Math.random() * 48 - 24); g.stroke();
    }
    var texPlatre = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) texPlatre.encoding = THREE.sRGBEncoding;
    var platreMat = new THREE.MeshStandardMaterial({ map: texPlatre, roughness: 1 });

    var EP2 = 1.2, H2 = 9; // épaisseur et hauteur des murs de l'école
    // sol en planches
    var solEcole = new THREE.Mesh(new THREE.BoxGeometry(58.8, 0.1, 58.8),
      new THREE.MeshStandardMaterial({ map: texBois(0.5), roughness: 0.95 }));
    solEcole.position.set(0, 0.05, 310); solEcole.receiveShadow = true;
    scene.add(solEcole);
    // murs extérieurs : porte d'entrée au sud (z=340) et porte de SORTIE au nord (z=280), ouvertures de 4 m (x -2..2)
    var seg = (60 + EP2 - 4) / 2;
    mur(-(2 + seg / 2), 280, seg, EP2, H2, platreMat); // nord ouest
    mur((2 + seg / 2), 280, seg, EP2, H2, platreMat);  // nord est (SORTIE)
    mur(-(2 + seg / 2), 340, seg, EP2, H2, platreMat); // sud ouest
    mur((2 + seg / 2), 340, seg, EP2, H2, platreMat);  // sud est (entrée)
    mur(30, 310, EP2, 60 + EP2, H2, platreMat);        // est
    mur(-30, 310, EP2, 60 + EP2, H2, platreMat);       // ouest
    // couloir central (x -8..8) séparé des 2 salles de classe, avec une porte dans chaque cloison (z 306..314)
    mur(8, 293, EP2, 26 + EP2, H2, platreMat);
    mur(8, 327, EP2, 26 + EP2, H2, platreMat);
    mur(-8, 293, EP2, 26 + EP2, H2, platreMat);
    mur(-8, 327, EP2, 26 + EP2, H2, platreMat);
    // linteaux au-dessus des 4 ouvertures (en hauteur : pas de collision)
    [[0, 280], [0, 340], [8, 310], [-8, 310]].forEach(function (p) {
      var l = mur(p[0], p[1], p[0] === 0 ? 5.2 : 1.6, p[0] === 0 ? 1.6 : 9.2, 1, platreMat);
      l.position.y = H2 - 0.5;
      rects.pop();
    });
    // porte en bois de la salle OUEST (ouverture de la cloison x=-8, z 306..314) : à CASSER au pied de biche
    porteAileOuest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 7.6),
      new THREE.MeshStandardMaterial({ map: texBois(0.85), roughness: 0.75 }));
    texMur(porteAileOuest, 7.6, 6);
    porteAileOuest.position.set(-8, 3, 310);
    porteAileOuest.castShadow = true; porteAileOuest.receiveShadow = true;
    scene.add(porteAileOuest);
    rectPorteAileOuest = { x: -8, z: 310, sx: 0.7, sz: 8 };
    rects.push(rectPorteAileOuest);
    toit(0, 310, 60 + EP2 + 1, 60 + EP2 + 1, H2 + 0.4);
    // grands tableaux noirs dans les 2 salles de classe
    var matTableau = new THREE.MeshStandardMaterial({ color: 0x14261c, roughness: 0.6 });
    [[8.7, 295], [8.7, 325], [-8.7, 295], [-8.7, 325]].forEach(function (p) {
      var tb = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 9), matTableau);
      tb.position.set(p[0], 2.8, p[1]); tb.castShadow = true;
      scene.add(tb);
    });
    // rangées de bureaux + chaises dans les 2 salles (4 rangées de 3 bureaux chacune)
    for (var r = 0; r < 4; r++) {
      var zr = 290 + r * 8;
      table(-13, zr); chaise(-13, zr + 2.5, Math.PI);
      table(-19, zr); chaise(-19, zr + 2.5, Math.PI);
      table(-25, zr); chaise(-25, zr + 2.5, Math.PI);
      table(13, zr); chaise(13, zr + 2.5, Math.PI);
      table(19, zr); chaise(19, zr + 2.5, Math.PI);
      table(25, zr); chaise(25, zr + 2.5, Math.PI);
    }
    // bureau du prof + livres dans chaque salle
    table(-19, 334); pileLivres(-19, 334.7);
    table(19, 286); pileLivres(19, 286.7);
    // étagères, livres et débris un peu partout
    etagere(-27, 285); pileLivres(-27, 286);
    etagere(27, 335); pileLivres(27, 336);
    caisse(-14, 300, 0.8); caisse(14, 320, 0.9); tonneau(3, 300); planches(-3, 322);
    caisse(5, 288, 0.7); planches(-20, 335); tonneau(20, 290);
    // casiers métalliques dans le couloir
    var matCasier = new THREE.MeshStandardMaterial({ color: 0x5a6470, metalness: 0.8, roughness: 0.5 });
    [-6.5, 6.5].forEach(function (x) {
      [288, 296, 324, 332].forEach(function (z) {
        var ca = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.1, 2.6), matCasier);
        ca.position.set(x, 1.05, z); ca.castShadow = true; ca.receiveShadow = true;
        scene.add(ca);
        cercles.push({ x: x, z: z, r: 1.5 });
      });
    });
    // panneau SORTIE vert au-dessus de la porte nord
    var panneau = new THREE.Mesh(new THREE.BoxGeometry(3, 0.7, 0.12),
      new THREE.MeshBasicMaterial({ color: 0x2bff6a }));
    panneau.position.set(0, H2 - 1.2, 280 + EP2 / 2 + 0.06);
    scene.add(panneau);
    // lumières qui clignotent
    function lampeEcole(x, y, z, couleur, i) {
      var l = new THREE.PointLight(couleur, i, 30, 1.7);
      l.position.set(x, y, z);
      scene.add(l);
      lumieresEcole.push({ lum: l, base: i });
    }
    lampeEcole(0, 7.5, 310, 0xbfd4ff, 0.8);   // couloir
    lampeEcole(-19, 7.5, 310, 0xffe0b0, 0.6);  // salle ouest
    lampeEcole(19, 7.5, 310, 0xbfd4ff, 0.6);   // salle est
    lampeEcole(0, 7.8, 283, 0x2bff6a, 0.9);    // sortie
    // ---------- 3 boîtiers électriques à alimenter (E) pour ouvrir la porte de sortie ----------
    var matBoitier = new THREE.MeshStandardMaterial({ color: 0x30343c, metalness: 0.7, roughness: 0.5 });
    [[8, 300, -1], [-30, 300, 1], [30, 322, -1]].forEach(function (p) {
      var bx = p[0] + p[2] * 0.85; // collé contre le mur
      var b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 1.0), matBoitier);
      b.position.set(bx, 1.6, p[1]); b.castShadow = true;
      var lampe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff3322 })); // rouge = pas encore alimenté
      lampe.position.set(p[0] + p[2] * 1.2, 2.35, p[1]);
      scene.add(b, lampe);
      boitiersElec.push({ x: p[0] + p[2] * 1.2, z: p[1], lampe: lampe, alimente: false });
    });
    // porte de sortie au nord : verrouillée tant que les 3 fils ne sont pas alimentés
    porteSortie = new THREE.Mesh(new THREE.BoxGeometry(4, H2, EP2),
      new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.85, roughness: 0.4 }));
    porteSortie.position.set(0, H2 / 2, 280);
    porteSortie.castShadow = true; porteSortie.receiveShadow = true;
    var lampePorte = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.15),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lampePorte.position.set(0, -3.5, EP2 / 2 + 0.08);
    porteSortie.add(lampePorte);
    porteSortie.userData.lampe = lampePorte;
    scene.add(porteSortie);
    rectPorteSortie = { x: 0, z: 280, sx: 4, sz: EP2 };
    rects.push(rectPorteSortie);
  })();

  // Cible style tir à l'arc : anneaux concentriques blanc/noir/bleu/rouge/jaune
  function texCible() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d');
    g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(64, 64, 46, 0, 7); g.fill();
    g.fillStyle = '#2e6fd8'; g.beginPath(); g.arc(64, 64, 32, 0, 7); g.fill();
    g.fillStyle = '#d82828'; g.beginPath(); g.arc(64, 64, 20, 0, 7); g.fill();
    g.fillStyle = '#f2c018'; g.beginPath(); g.arc(64, 64, 9, 0, 7); g.fill();
    var t = new THREE.CanvasTexture(c);
    if (THREE.sRGBEncoding) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // ---------- Souterrain sous l'école (partie 2 : sous la trappe, y = -12) ----------
  (function construireSouterrain() {
    var mat = new THREE.MeshStandardMaterial({ map: texPierre(0.4), roughness: 1 });
    function murU(cx, cz, sx, sz, h, noCol) {
      h = h || 8;
      var m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), mat);
      texMur(m, Math.max(sx, sz), h);
      m.position.set(cx, -12 + h / 2, cz);
      m.castShadow = true; m.receiveShadow = true;
      scene.add(m);
      // collision UNIQUEMENT au niveau souterrain (sinon le mur bloque aussi l'école au-dessus)
      if (!noCol) rects.push({ x: cx, z: cz, sx: sx, sz: sz, yMin: -13, yMax: -3 });
      return m;
    }
    // sol et plafond du souterrain (z 274..324, sous la trappe derrière la porte de sortie)
    var f = new THREE.Mesh(new THREE.BoxGeometry(29, 0.3, 51), mat);
    f.position.set(0, -12.15, 299); f.receiveShadow = true; scene.add(f);
    var pl = new THREE.Mesh(new THREE.BoxGeometry(29, 0.5, 51), mat);
    pl.position.set(0, -3.75, 299); scene.add(pl);
    // murs (porte au sud z=324, ouverture de 4 m en x -2..2)
    murU(0, 274, 29, 1);                 // nord (sous la trappe, derrière la porte de l'école z=280)
    murU(14, 299, 1, 51);                // est
    murU(-14, 299, 1, 51);               // ouest
    var segU = (29 - 4) / 2;
    murU(-(2 + segU / 2), 324, segU, 1); // sud ouest
    murU((2 + segU / 2), 324, segU, 1);  // sud est (porte)
    var lint = murU(0, 324, 5, 1, 1); lint.position.y = -4.3; rects.pop(); // linteau, en hauteur
    // cloison avec PORTE à z=281 : entre l'antichambre (où on tombe, z 274..281) et la grande salle
    var segA = (29 - 4) / 2;
    murU(-(2 + segA / 2), 281, segA, 1); // cloison ouest
    murU((2 + segA / 2), 281, segA, 1);  // cloison est
    var lintE = murU(0, 281, 5, 1, 1); lintE.position.y = -4.3; rects.pop(); // linteau (en hauteur)
    porteEntree = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 0.8),
      new THREE.MeshStandardMaterial({ map: texBois(0.7), roughness: 0.8 }));
    texMur(porteEntree, 4, 8);
    porteEntree.position.set(0, -8, 281);
    porteEntree.castShadow = true; porteEntree.receiveShadow = true;
    scene.add(porteEntree);
    rectPorteEntree = { x: 0, z: 281, sx: 4, sz: 0.8, yMin: -13, yMax: -3 };
    rects.push(rectPorteEntree);
    // faux "trou" noir + trappe articulée derrière la porte nord
    var trou = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.MeshBasicMaterial({ color: 0x000000 }));
    trou.rotation.x = -Math.PI / 2; trou.position.set(0, 0.105, 277);
    scene.add(trou);
    pivotTrappe = new THREE.Group();
    pivotTrappe.position.set(-2.2, 0.12, 274.8); // gond au bord ouest
    var panneauTrappe = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.08, 4.4),
      new THREE.MeshStandardMaterial({ map: texBois(0.6), roughness: 0.9 }));
    panneauTrappe.position.set(2.2, 0, 2.2);
    panneauTrappe.castShadow = true; panneauTrappe.receiveShadow = true;
    pivotTrappe.add(panneauTrappe);
    scene.add(pivotTrappe);
    rectTrappe = { x: 0, z: 277, sx: 4.4, sz: 4.4 };
    rects.push(rectTrappe); // bloque le trou tant que la trappe est fermée
    // porte du fond du souterrain (sud) : s'ouvre quand les 5 cibles sont touchées
    porteSouterrain = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 1),
      new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.85, roughness: 0.4 }));
    porteSouterrain.position.set(0, -8, 324);
    porteSouterrain.castShadow = true;
    var lampePS = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.15),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lampePS.position.set(0, 3, 0.6);
    porteSouterrain.add(lampePS);
    porteSouterrain.userData.lampe = lampePS;
    scene.add(porteSouterrain);
    rectPorteSouterrain = { x: 0, z: 324, sx: 4, sz: 1, yMin: -13, yMax: -3 };
    rects.push(rectPorteSouterrain);
    // barrière devant la porte du fond : elle s'ENFONCE dans le sol quand les 5 cibles sont touchées
    barrierePorte = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x6a7280, metalness: 0.8, roughness: 0.45 }));
    barrierePorte.position.set(0, -10.5, 320);
    barrierePorte.castShadow = true; barrierePorte.receiveShadow = true;
    scene.add(barrierePorte);
    rectBarrierePorte = { x: 0, z: 320, sx: 12, sz: 0.6, yMin: -13, yMax: -3 };
    rects.push(rectBarrierePorte);
    // 5 cibles style tir à l'arc SUR PIED au centre de la salle (le carré), visibles de partout
    // cibles à hauteur des yeux (y ~ -9.6/-10.2, ligne de tir ~ -10.5) pour être touchables facilement
    [[-6, -9.6, 305], [-3, -10.2, 310], [0, -9.6, 303], [3, -10.2, 310], [6, -9.6, 305]].forEach(function (p) {
      var pied = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8), mat);
      pied.position.set(p[0], -10.9, p[2]); pied.castShadow = true;
      scene.add(pied);
      cercles.push({ x: p[0], z: p[2], r: 0.35, yMin: -13, yMax: -3 }); // collision seulement au niveau souterrain
      var c = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32),
        new THREE.MeshBasicMaterial({ map: texCible(), side: THREE.DoubleSide }));
      c.position.set(p[0], p[1], p[2]); // double face : visible des 4 côtés
      scene.add(c);
      cibles.push({ mesh: c, pos: new THREE.Vector3(p[0], p[1], p[2]), touchee: false });
    });
    // le sniper sur un socle au milieu du souterrain (pas de collision 2D : il est sous l'école)
    var socle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), mat);
    socle.position.set(3.5, -11.55, 277); socle.castShadow = true; // SUR LE CARRÉ d'atterrissage (antichambre), visible dès la chute
    scene.add(socle);
    sniperMesh = modeleSniper();
    sniperMesh.position.set(3.5, -10.85, 277);
    sniperMesh.rotation.y = 0.5;
    scene.add(sniperMesh);
    // barrières basses autour des cibles : elles s'ENFONCENT dans le sol quand les 5 cibles sont touchées
    var barMat = new THREE.MeshStandardMaterial({ color: 0x6a7280, metalness: 0.8, roughness: 0.45 });
    [[-10, 299, 0.4, 28], [10, 299, 0.4, 28], [0, 288, 20.4, 0.4]].forEach(function (p) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(p[2], 1.1, p[3]), barMat);
      texMur(b, Math.max(p[2], p[3]), 1.1);
      b.position.set(p[0], -12 + 0.55, p[1]);
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      var r = { x: p[0], z: p[1], sx: p[2], sz: p[3], yMin: -13, yMax: -3 };
      rects.push(r);
      barrieres.push({ mesh: b, rect: r, ouverte: false });
    });
    // lumières sombres du souterrain (+ une au-dessus du sniper dans l'antichambre)
    [[0, -5, 310, 0xff5533, 0.9], [-10, -5, 320, 0x8899ff, 0.5], [10, -5, 300, 0x8899ff, 0.5],
     [0, -5, 277, 0xffd9a0, 0.9]].forEach(function (p) {
      var l = new THREE.PointLight(p[3], p[4], 25, 1.7);
      l.position.set(p[0], p[1], p[2]);
      scene.add(l);
      lumieresEcole.push({ lum: l, base: p[4] });
    });
  })();

  // ---------- PARTIE 3 : les catacombes (au nord, z 402..458, x -20..20) ----------
  (function construireCatacombes() {
    var mat = new THREE.MeshStandardMaterial({ map: texPierre(0.45), roughness: 1 });
    var EP3 = 1, H3 = 7;
    var solC = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 56), mat);
    solC.position.set(0, -0.1, 430); solC.receiveShadow = true; scene.add(solC);
    toit(0, 430, 40 + EP3 + 1, 56 + EP3 + 1, H3 + 0.4);
    // murs : entrée sud (z=458, ouverture 4 m), porte du fond nord (z=402, ouverture 4 m)
    var seg3 = (40 + EP3 - 4) / 2;
    mur(-(2 + seg3 / 2), 402, seg3, EP3, H3, mat); // nord ouest
    mur((2 + seg3 / 2), 402, seg3, EP3, H3, mat);  // nord est (porte finale)
    mur(-(2 + seg3 / 2), 458, seg3, EP3, H3, mat); // sud ouest
    mur((2 + seg3 / 2), 458, seg3, EP3, H3, mat);  // sud est (entrée)
    // mur est en 2 morceaux avec une ouverture (z 428..432) vers une petite salle annexe
    var segE = (56 + EP3 - 4) / 2;
    mur(20, 430 - (2 + segE / 2), EP3, segE, H3, mat);
    mur(20, 430 + (2 + segE / 2), EP3, segE, H3, mat);
    var lintS = mur(20, 430, 1.4, 5.2, 1, mat); lintS.position.y = H3 - 0.5; rects.pop();
    mur(-20, 430, EP3, 56 + EP3, H3, mat);        // ouest
    // petite salle annexe à l'est avec des munitions
    mur(28, 430, EP3, 12 + EP3, H3, mat);         // fond de l'annexe
    mur(24, 424, 8 + EP3, EP3, H3, mat);          // nord de l'annexe
    mur(24, 436, 8 + EP3, EP3, H3, mat);          // sud de l'annexe
    var solA = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 12), mat);
    solA.position.set(24, -0.1, 430); solA.receiveShadow = true; scene.add(solA);
    toit(24, 430, 8 + EP3 + 1, 12 + EP3 + 1, H3 + 0.4);
    caisseAmmo(24, 430);
    var lumA = new THREE.PointLight(0xffd24a, 0.8, 14, 1.8);
    lumA.position.set(24, 5, 430); scene.add(lumA);
    lumieresEcole.push({ lum: lumA, base: 0.8 });
    [[0, 402], [0, 458]].forEach(function (p) {   // linteaux (en hauteur)
      var l = mur(p[0], p[1], 5.2, 1.4, 1, mat);
      l.position.y = H3 - 0.5; rects.pop();
    });
    // piliers le long du couloir + sarcophages contre les murs
    for (var z = 410; z <= 450; z += 8) { pilier(-10, z, 0.7, H3); pilier(10, z, 0.7, H3); }
    function sarco(x, zz) {
      var s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 2.4), pierreGrise);
      s.position.set(x, 0.4, zz); s.castShadow = true; s.receiveShadow = true;
      scene.add(s); cercles.push({ x: x, z: zz, r: 1.4 });
    }
    sarco(-18.5, 414); sarco(-18.5, 428); sarco(18.5, 420); sarco(18.5, 436); sarco(-18.5, 444); sarco(18.5, 450); sarco(18.5, 410);
    // débris et ossements au sol
    caisse(-15, 440, 0.8); planches(15, 415); tonneau(-15, 418); caisse(12, 448, 0.7); planches(-8, 452);
    var osMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 1 });
    [[-5, 432], [3, 418], [-12, 446], [8, 442], [0, 408], [14, 426]].forEach(function (p) {
      var os = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.18), osMat);
      os.position.set(p[0], 0.07, p[1]); os.rotation.y = Math.random() * 3;
      scene.add(os);
    });
    // la CLÉ des catacombes (dorée, bien visible) sur un sarcophage
    var cle = new THREE.Group();
    var matOr = new THREE.MeshBasicMaterial({ color: 0xffd24a });
    var anneau = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 8, 16), matOr);
    var tige = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 8), matOr);
    tige.position.y = -0.24;
    var dent = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.04), matOr);
    dent.position.set(0.06, -0.4, 0);
    cle.add(anneau, tige, dent);
    cle.position.set(-18.5, 1.0, 428);
    scene.add(cle);
    cleCatacombes = cle;
    var lumCle = new THREE.PointLight(0xffd24a, 1.2, 12, 1.8);
    lumCle.position.set(-18.5, 2, 428);
    scene.add(lumCle);
    // porte du fond (nord) : s'ouvre avec la clé des catacombes
    porteCatacombes = new THREE.Mesh(new THREE.BoxGeometry(4, H3, EP3),
      new THREE.MeshStandardMaterial({ color: 0x3a4048, metalness: 0.85, roughness: 0.4 }));
    porteCatacombes.position.set(0, H3 / 2, 402);
    porteCatacombes.castShadow = true;
    var lampePC = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.15),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    lampePC.position.set(0, -2.5, EP3 / 2 + 0.08);
    porteCatacombes.add(lampePC);
    porteCatacombes.userData.lampe = lampePC;
    scene.add(porteCatacombes);
    rectPorteCatacombes = { x: 0, z: 402, sx: 4, sz: EP3 };
    rects.push(rectPorteCatacombes);
    // lumières qui clignotent
    [[0, 6, 430, 0xff8844, 0.7], [-12, 6, 416, 0x8899ff, 0.5], [12, 6, 444, 0xff8844, 0.5],
     [0, 6, 446, 0x8899ff, 0.5], [-16, 6, 436, 0xff8844, 0.6]].forEach(function (p) {
      var l = new THREE.PointLight(p[3], p[4], 28, 1.7);
      l.position.set(p[0], p[1], p[2]);
      scene.add(l);
      lumieresEcole.push({ lum: l, base: p[4] });
    });
  })();

  // ---------- Poussière / lucioles dans l'air ----------
  var nbL = 250, lPos = new Float32Array(nbL * 3);
  for (var l = 0; l < nbL; l++) {
    lPos[l * 3] = (Math.random() - 0.5) * 180;
    lPos[l * 3 + 1] = Math.random() * 14 + 0.4;
    lPos[l * 3 + 2] = (Math.random() - 0.5) * 180;
  }
  var lGeo = new THREE.BufferGeometry();
  lGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  var lucioles = new THREE.Points(lGeo, new THREE.PointsMaterial({ color: 0xa8b8ff, size: 0.05, transparent: true, opacity: 0.7 }));
  scene.add(lucioles);

  // ---------- Le personnage 3D vu de l'intérieur (caméra sur le torse) ----------
  var corps = new THREE.Group();
  var peau = new THREE.MeshStandardMaterial({ color: 0x8a6f5c, roughness: 0.8 });
  var tissu = new THREE.MeshStandardMaterial({ color: 0x27303a, roughness: 0.9 });
  var pantalon = new THREE.MeshStandardMaterial({ color: 0x1d2126, roughness: 0.9 });

  var torse = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.42, 10), tissu);
  torse.position.set(0, -0.34, -0.05);
  var epauleG = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), tissu);
  epauleG.position.set(-0.19, -0.18, -0.02);
  var epauleD = epauleG.clone(); epauleD.position.x = 0.19;
  var brasG = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.5, 8), tissu);
  brasG.position.set(-0.21, -0.5, -0.03); brasG.rotation.z = 0.08;
  var brasD = brasG.clone(); brasD.position.x = 0.21; brasD.rotation.z = -0.08;
  var mainG = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), peau);
  mainG.position.set(-0.235, -0.76, -0.03);
  var mainD = mainG.clone(); mainD.position.x = 0.235;
  var bassin = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.22, 10), pantalon);
  bassin.position.set(0, -0.62, -0.02);
  var cuisseG = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.4, 8), pantalon);
  cuisseG.position.set(-0.09, -0.9, 0.02);
  var cuisseD = cuisseG.clone(); cuisseD.position.x = 0.09;

  corps.add(torse, epauleG, epauleD, brasG, brasD, mainG, mainD, bassin, cuisseG, cuisseD);
  camera.add(corps); // le corps est accroché à la caméra

  // Objet tenu dans la main droite (l'objet sélectionné de l'inventaire)
  var objetEnMain = new THREE.Group();
  objetEnMain.position.set(0.3, -0.3, -0.5);
  objetEnMain.rotation.set(0.15, 0.5, -0.25);
  objetEnMain.scale.setScalar(1.6);
  camera.add(objetEnMain);
  // Petite lampe frontale faible pour éclairer le corps et l'objet en main
  var lumMain = new THREE.PointLight(0xfff2dd, 0.5, 2.5, 1.5);
  lumMain.position.set(0, -0.15, -0.1);
  camera.add(lumMain);

  var mainBiche = new THREE.Group();
  mainBiche.add(modelePiedDeBiche()); // même modèle réaliste en main (éclairé par la lampe frontale)
  mainBiche.visible = false;

  var mainCle = new THREE.Group();
  // Matériau non éclairé doré : toujours visible, même dans le noir
  var matCleVif = new THREE.MeshBasicMaterial({ color: 0xffd24a });
  var mcAnneau = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 14), matCleVif);
  var mcTige = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 8), matCleVif);
  mcTige.position.y = -0.15;
  var mcDent = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.025), matCleVif);
  mcDent.position.set(0.035, -0.27, 0);
  mainCle.add(mcAnneau, mcTige, mcDent);
  mainCle.visible = false;

  var mainPistolet = modelePistolet();
  mainPistolet.visible = false;
  var mainSniper = modeleSniper();
  mainSniper.visible = false;

  objetEnMain.add(mainBiche, mainCle, mainPistolet, mainSniper);
  objetEnMain.traverse(function (o) { o.castShadow = false; }); // pas d'ombre portée par l'arme en main

  function majObjetEnMain() {
    // Un seul objet à la fois dans la main : celui sélectionné avec la molette
    var nom = inventaire.length ? inventaire[slotSel].nom : null;
    mainBiche.visible = (nom === 'Pied de biche');
    mainCle.visible = (nom === 'Clé rouillée');
    mainPistolet.visible = (nom === 'Pistolet');
    mainSniper.visible = (nom === 'Sniper');
  }

  // ---------- État du joueur ----------
  var yaw = 0;                // au spawn, on regarde le donjon (nord)
  var pitch = 0;
  var pos = new THREE.Vector3(0, 1.62, 34); // dans la cour, face au donjon
  var velY = 0;
  var AU_SOL = 1.62;
  var keys = {};
  var torcheOn = true;
  var viser = false; // visée au sniper : clic droit maintenu
  var enJeu = false;
  var partie = 1;                 // partie 1 tant que le portail n'est pas franchi
  var enAttentePartie2 = false;   // vrai entre l'entrée dans le portail et le clic de reprise
  var enAttentePartie3 = false;   // vrai entre la fin de la partie 2 et le clic de reprise
  var bob = 0;
  var cache = false; // caché sous le lit

  // ---------- Contrôles ----------
  var canvas = renderer.domElement;
  var overlay = document.getElementById('overlay');

  overlay.addEventListener('click', function () {
    if (mort || partieGagnee) { location.reload(); return; } // recommencer après mort ou victoire
    try { canvas.requestPointerLock(); } catch (e) { /* mode libre */ }
  });

  document.addEventListener('pointerlockchange', function () {
    enJeu = document.pointerLockElement === canvas;
    overlay.classList.toggle('cache', enJeu);
    if (enJeu) {
      demarrerAudio(); if (!startTime) startTime = Date.now();
      // Transition vers la partie 2 quand on clique après être entré dans le portail
      if (enAttentePartie2) {
        enAttentePartie2 = false;
        demarrerPartie2(); // téléportation dans l'école abandonnée
      }
      if (enAttentePartie3) { // transition animée vers la partie 3
        enAttentePartie3 = false;
        demarrerPartie3();
      }
    }
  });

  document.addEventListener('mousemove', function (e) {
    if (!enJeu) return;
    yaw -= e.movementX * 0.0021;
    pitch -= e.movementY * 0.0021;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
  });

  // ---------- Livre (L) et digicode (chiffres) ----------
  var pageLivreEl = document.getElementById('pageLivre');
  var digicodeEl = document.getElementById('digicode');
  var codeSaisiEl = document.getElementById('codeSaisi');
  var saisieCode = null; // null = digicode fermé ; sinon chaîne en cours

  function ouvrirLivre() {
    if (!aObjet('Livre du code (7-3-9-2)')) return;
    pageLivreEl.style.display = 'flex';
  }
  function fermerLivre() { pageLivreEl.style.display = 'none'; }

  function ouvrirDigicode() {
    saisieCode = '';
    codeSaisiEl.textContent = '_ _ _ _';
    codeSaisiEl.classList.remove('faux');
    digicodeEl.style.display = 'flex';
  }
  function fermerDigicode() {
    saisieCode = null;
    digicodeEl.style.display = 'none';
  }
  function validerCode() {
    if (saisieCode === '7392') {
      fermerDigicode();
      coffreOuvert = true; coffreEnCours = true;      // coffre ouest (pistolet)
      coffre2Ouvert = true; coffre2EnCours = true;    // coffre est (cristal)
      cleSortie.visible = true;
      pistolet.visible = true;
      lumCoffre.intensity = 1.8; lumCoffre.color.setHex(0x66ff88);
      lumCoffre2.intensity = 1.8; lumCoffre2.color.setHex(0x66ff88);
      missionEl.textContent = '🎯 Mission 6 : prends le pistolet (coffre ouest) et le cristal (coffre est) !';
    } else {
      codeSaisiEl.classList.add('faux');
      codeSaisiEl.textContent = saisieCode + ' ✗';
      saisieCode = '';
      setTimeout(function () {
        if (saisieCode !== null) { codeSaisiEl.classList.remove('faux'); codeSaisiEl.textContent = '_ _ _ _'; }
      }, 600);
    }
  }

  window.addEventListener('keydown', function (e) {
    // Digicode : les chiffres entrent le code
    if (saisieCode !== null) {
      var m = e.code.match(/^(?:Digit|Numpad)([0-9])$/);
      if (m) {
        saisieCode += m[1];
        codeSaisiEl.textContent = (saisieCode + '____').slice(0, 4).split('').join(' ').replace(/_/g, '_');
        if (saisieCode.length >= 4) validerCode();
      }
      if (e.code === 'Escape' || e.code === 'KeyE') fermerDigicode();
      if (e.code === 'Enter' || e.code === 'NumpadEnter') validerCode();
      e.preventDefault();
      return;
    }
    // Tchat ouvert : Entrée = envoyer, Échap = fermer (le reste va dans le champ de saisie)
    if (chatOuvert) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') envoyerChat();
      else if (e.code === 'Escape') fermerChat();
      return;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'KeyT') { ouvrirChat(); e.preventDefault(); return; }
    keys[e.code] = true;
    if (e.code === 'KeyL') { // ouvrir/fermer le livre
      if (pageLivreEl.style.display === 'flex') fermerLivre();
      else ouvrirLivre();
    }
    if (e.code === 'KeyF') {
      torcheOn = !torcheOn;
      torche.visible = torcheOn; torche.target.visible = torcheOn;
      majLumiereGenerale();
    }
    if (e.code === 'KeyE') interagir();
    if (e.code === 'KeyC') basculerCache();
    if (['Space', 'ArrowUp', 'ArrowDown'].indexOf(e.code) >= 0) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });

  // Clic gauche avec le pied de biche en main = un coup
  var attaqueT = -1; // -1 = pas d'attaque en cours
  var coupEnfonce = false; // le pied de biche s'enfonce dans le monstre quand ça touche

  // ---------- Balles visibles (tracers) + flash de bouche ----------
  var balles = [];
  var flashTir = new THREE.PointLight(0xffdd88, 0, 7, 2);
  flashTir.position.set(0.25, -0.3, -0.6);
  camera.add(flashTir);
  var flashTirT = 0;

  function tirerBalle() {
    var dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    var depart = camera.position.clone().add(dir.clone().multiplyScalar(0.55));
    depart.y -= 0.12; // hauteur du canon
    var b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.3, 6),
      new THREE.MeshBasicMaterial({ color: 0xffee88 }));
    // le cylindre a son axe sur Y : on l'aligne sur la direction du tir
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    b.position.copy(depart);
    scene.add(b);
    balles.push({ mesh: b, dir: dir.clone(), dist: 0 });
  }

  // ---------- Sang : gerbe de particules + tache au sol ----------
  var gerbes = [];
  function sang(x, y, z) {
    var n = 70;
    var geo = new THREE.BufferGeometry();
    var p = new Float32Array(n * 3), vel = [];
    for (var i = 0; i < n; i++) {
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      vel.push([(Math.random() - 0.5) * 5, 1.5 + Math.random() * 4, (Math.random() - 0.5) * 5]);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    var mat = new THREE.PointsMaterial({ color: 0xa01010, size: 0.1, transparent: true, opacity: 1 });
    var pts = new THREE.Points(geo, mat);
    scene.add(pts);
    gerbes.push({ pts: pts, vel: vel, life: 0.9, mat: mat, tache: false });
  }
  function tacheSang(x, z) {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    g.fillStyle = 'rgba(90,8,8,0.85)';
    for (var i = 0; i < 12; i++) {
      g.beginPath(); g.arc(32 + (Math.random() - 0.5) * 40, 32 + (Math.random() - 0.5) * 40, 3 + Math.random() * 12, 0, Math.PI * 2); g.fill();
    }
    var tex = new THREE.CanvasTexture(c);
    var tache = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false }));
    tache.rotation.x = -Math.PI / 2;
    tache.position.set(x, 0.03, z);
    scene.add(tache);
    gerbes.push({ tacheM: tache, life: 25, mat: tache.material, tache: true });
  }
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // pas de menu au clic droit
  document.addEventListener('mouseup', function (e) { if (e.button === 2) viser = false; });
  document.addEventListener('mousedown', function (e) {
    if (!enJeu || chatOuvert) return; // pas de tir quand le tchat est ouvert
    if (e.button === 2) { viser = true; return; } // clic droit maintenu = visée (lunette)
    if (e.button !== 0) return;
    var nom = inventaire.length ? inventaire[slotSel].nom : null;
    if (nom === 'Pistolet' || nom === 'Sniper') {
      if (munitions <= 0) { sonClicVide(); return; } // plus de balles
      munitions--;
      majInventaire(); // met à jour le compteur de balles
      sonTir();
      tirerBalle(); // tracer lumineux visible
      flashTirT = 0.09; // flash de bouche
      if (!monstreMort) {
        var fdx2 = -Math.sin(yaw), fdz2 = -Math.cos(yaw);
        var mx2 = monstrePos.x - pos.x, mz2 = monstrePos.z - pos.z;
        var md2 = Math.sqrt(mx2 * mx2 + mz2 * mz2);
        if (md2 < 20 && md2 > 0.001 && (mx2 * fdx2 + mz2 * fdz2) / md2 > 0.5) {
          sang(monstrePos.x, 1.6, monstrePos.z);
          tacheSang(monstrePos.x, monstrePos.z);
          pvMonstre = 0;
          tuerMonstre();
        }
      }
      return;
    }
    if (nom === 'Pied de biche') {
      attaqueT = 0; sonCoup();
      // Casser la porte de la salle ouest de l'école avec le pied de biche
      if (partie === 2 && !porteCassee && distance2D(-8, 310) < 4.2) {
        porteCassee = true;
        var iPC = rects.indexOf(rectPorteAileOuest);
        if (iPC >= 0) rects.splice(iPC, 1);
        sonZap();
        afficherMsg('🔨 La porte de la salle ouest vole en éclats !', 3000);
      }
      // Le coup touche le monstre s'il est à moins de 2.8 m et devant toi
      if (!monstreMort) {
        var fdx = -Math.sin(yaw), fdz = -Math.cos(yaw); // devant
        var mx = monstrePos.x - pos.x, mz = monstrePos.z - pos.z;
        var md = Math.sqrt(mx * mx + mz * mz);
        if (md < 5.6 && md > 0.001 && (mx * fdx + mz * fdz) / md > 0.2) {
          pvMonstre--;
          stunT = 0.6; hitFlash = 0.3;
          coupEnfonce = true; // le pied de biche rentre dans le corps
          sang(monstrePos.x, 1.6, monstrePos.z);   // gerbe de sang
          tacheSang(monstrePos.x, monstrePos.z);   // tache au sol
          monstrePos.x += (mx / md) * 3; // recul
          monstrePos.z += (mz / md) * 3;
          if (pvMonstre <= 0) tuerMonstre();
        }
      }
      // le pied de biche peut aussi frapper le boss
      if (bossApparu && !bossMort) {
        var bx = bossPos.x - pos.x, bz = bossPos.z - pos.z;
        var bd2 = Math.sqrt(bx * bx + bz * bz);
        if (bd2 < 5.6 && bd2 > 0.001 && (bx * fdx + bz * fdz) / bd2 > 0.2) {
          bossPV--; coupEnfonce = true;
          sang(bossPos.x, 1.9, bossPos.z); tacheSang(bossPos.x, bossPos.z);
          bossPos.x += (bx / bd2) * 3; bossPos.z += (bz / bd2) * 3;
          if (bossPV <= 0) {
            bossMort = true; scene.remove(boss);
            stopMusiquePeur(); // fin de la musique d'angoisse du boss
            missionEl.textContent = '🎯 Mission 10 : sors du château par la poterne sud !';
            afficherMsg('✔ Le boss de la crypte est tué !', 4000);
            // Fin de la partie 1 : le portail apparaît DANS la salle du boss (la crypte), là où il meurt
            if (partie === 1 && !portailActif) {
              var tmpB = { x: bossPos.x, z: bossPos.z };
              pousserCollisions(tmpB, 2.6); // le portail n'apparaît pas dans un mur
              tmpB.x = Math.max(-21, Math.min(21, tmpB.x));
              tmpB.z = Math.max(-116, Math.min(-87, tmpB.z));
              creerPortail(tmpB.x, tmpB.z);
              portailActif = true;
              missionEl.textContent = '🌀 Bravo ! Partie 1 terminée — entre dans le portail violet !';
              afficherMsg('🏆 Bravo ! Vous avez terminé la première partie !', 6000);
            }
          }
        }
      }
    }
  });

  // Bruit de whoosh du coup de pied de biche
  function sonCoup() {
    if (!audioCtx) return;
    try {
      var buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.15, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      var src = audioCtx.createBufferSource(); src.buffer = buffer;
      var f = audioCtx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1;
      var g = audioCtx.createGain(); g.gain.value = 0.25;
      src.connect(f); f.connect(g); g.connect(audioCtx.destination);
      src.start();
    } catch (e) { /* pas de son */ }
  }

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- Horodatage (date + heure en direct) ----------
  var elDate = document.getElementById('dateHeure');
  function majHorodatage() {
    var maintenant = new Date();
    var date = maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    var heure = maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    elDate.textContent = date.charAt(0).toUpperCase() + date.slice(1) + ' — ' + heure;
  }
  majHorodatage();
  setInterval(majHorodatage, 1000);

  // ---------- Minicarte (haut à gauche) ----------
  var mapCanvas = document.getElementById('minimap');
  var mapCtx = mapCanvas.getContext('2d');
  var MAP_TAILLE = mapCanvas.width;
  var MAP_MONDE = 244; // taille de la carte
  var MAP_CX = 0, MAP_CZ = 0; // centre de la carte (partie 2 : centrée sur l'école)
  function m2cX(v) { return (v - MAP_CX + MAP_MONDE / 2) / MAP_MONDE * MAP_TAILLE; }
  function m2cZ(v) { return (v - MAP_CZ + MAP_MONDE / 2) / MAP_MONDE * MAP_TAILLE; }

  function dessinerCarte() {
    mapCtx.clearRect(0, 0, MAP_TAILLE, MAP_TAILLE);
    mapCtx.fillStyle = 'rgba(8, 8, 14, 0.85)';
    mapCtx.fillRect(0, 0, MAP_TAILLE, MAP_TAILLE);
    // murs
    mapCtx.fillStyle = '#8f8fa0';
    for (var i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (r.rond) {
        mapCtx.beginPath();
        mapCtx.arc(m2cX(r.x), m2cZ(r.z), Math.max(r.sx, r.sz) / MAP_MONDE * MAP_TAILLE / 2, 0, Math.PI * 2);
        mapCtx.fill();
      } else {
        mapCtx.fillRect(m2cX(r.x - r.sx / 2), m2cZ(r.z - r.sz / 2), r.sx / MAP_MONDE * MAP_TAILLE, r.sz / MAP_MONDE * MAP_TAILLE);
      }
    }
    // torches
    mapCtx.fillStyle = '#ff9a3c';
    for (var f = 0; f < flammes.length; f++) {
      mapCtx.fillRect(m2cX(flammes[f].lum.position.x) - 1.5, m2cZ(flammes[f].lum.position.z) - 1.5, 3, 3);
    }
    // coffres du donjon : points dorés (mission 5)
    mapCtx.fillStyle = '#ffd24a';
    if (!coffreOuvert) {
      mapCtx.beginPath();
      mapCtx.arc(m2cX(-18), m2cZ(-60), 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    if (!coffre2Ouvert) {
      mapCtx.fillStyle = '#66ff88';
      mapCtx.beginPath();
      mapCtx.arc(m2cX(18), m2cZ(-60), 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // portail violet (fin de la partie 1)
    if (portailActif && partie === 1 && portail) {
      mapCtx.fillStyle = '#c26bff';
      mapCtx.beginPath();
      mapCtx.arc(m2cX(portail.x), m2cZ(portail.z), 4, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // (le monstre n'apparaît plus sur la carte : il faut le trouver dans le noir)
    // joueur : flèche selon la direction de vue
    var px = m2cX(pos.x), pz = m2cZ(pos.z);
    mapCtx.save();
    mapCtx.translate(px, pz);
    mapCtx.rotate(-yaw);
    mapCtx.fillStyle = '#ff3b3b';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6); mapCtx.lineTo(4.5, 5); mapCtx.lineTo(0, 2.5); mapCtx.lineTo(-4.5, 5);
    mapCtx.closePath(); mapCtx.fill();
    mapCtx.restore();
  }

  // ---------- Ambiance sonore (bourdonnement + vent en WebAudio) ----------
  var audioCtx = null, droneOn = false;
  function demarrerAudio() {
    if (droneOn) return;
    droneOn = true;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      var gain = audioCtx.createGain(); gain.gain.value = 0.05; gain.connect(audioCtx.destination);
      [55, 55.7, 110.3].forEach(function (f) {
        var o = audioCtx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        var filtre = audioCtx.createBiquadFilter(); filtre.type = 'lowpass'; filtre.frequency.value = 220;
        o.connect(filtre); filtre.connect(gain); o.start();
      });
      var buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      var vent = audioCtx.createBufferSource(); vent.buffer = buffer; vent.loop = true;
      var filtreVent = audioCtx.createBiquadFilter(); filtreVent.type = 'bandpass'; filtreVent.frequency.value = 400; filtreVent.Q.value = 0.6;
      var gainVent = audioCtx.createGain(); gainVent.gain.value = 0.015;
      vent.connect(filtreVent); filtreVent.connect(gainVent); gainVent.connect(audioCtx.destination);
      vent.start();
    } catch (e) { /* pas de son */ }
  }

  // ---------- Collisions (réutilisables : joueur et monstre) ----------
  function pousserCollisions(p, R) {
    var i, o;
    for (i = 0; i < cercles.length; i++) {
      o = cercles[i];
      if (o.yMin !== undefined && (p.y < o.yMin || p.y > o.yMax)) continue; // obstacle d'un autre niveau (souterrain)
      if (cache && o === litCollision) continue; // on peut être sous le lit quand on est caché
      var dx = p.x - o.x, dz = p.z - o.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < o.r + R && dist > 0.0001) {
        p.x = o.x + (dx / dist) * (o.r + R);
        p.z = o.z + (dz / dist) * (o.r + R);
      }
    }
    for (i = 0; i < rects.length; i++) {
      var r = rects[i];
      if (r.rond) continue;
      if (r.yMin !== undefined && (p.y < r.yMin || p.y > r.yMax)) continue; // mur d'un autre niveau (souterrain)
      var minX = r.x - r.sx / 2, maxX = r.x + r.sx / 2;
      var minZ = r.z - r.sz / 2, maxZ = r.z + r.sz / 2;
      var cx = Math.max(minX, Math.min(p.x, maxX));
      var cz = Math.max(minZ, Math.min(p.z, maxZ));
      var ddx = p.x - cx, ddz = p.z - cz;
      var d2 = ddx * ddx + ddz * ddz;
      if (d2 < R * R) {
        if (d2 > 0.000001) {
          var d = Math.sqrt(d2);
          p.x = cx + (ddx / d) * R;
          p.z = cz + (ddz / d) * R;
        } else {
          var penG = p.x - minX + R, penD = maxX - p.x + R;
          var penH = p.z - minZ + R, penB = maxZ - p.z + R;
          var minPen = Math.min(penG, penD, penH, penB);
          if (minPen === penG) p.x = minX - R;
          else if (minPen === penD) p.x = maxX + R;
          else if (minPen === penH) p.z = minZ - R;
          else p.z = maxZ + R;
        }
      }
    }
  }
  function resoudreCollisions() { pousserCollisions(pos, 0.3); }

  // ---------- Boucle de jeu ----------
  var clock = new THREE.Clock();

  function boucle() {
    requestAnimationFrame(boucle);
    var dt = Math.min(clock.getDelta(), 0.05);
    var t = clock.elapsedTime;

    // Déplacement
    var avant = (keys['KeyW'] || keys['KeyZ'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    var droite = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['KeyQ'] || keys['ArrowLeft'] ? 1 : 0);
    var course = keys['ShiftLeft'] || keys['ShiftRight'];
    var vitesse = course ? 12.75 : 6.3;

    if (enJeu && !cache && (avant || droite)) { // immobile quand on est caché sous le lit
      var sin = Math.sin(yaw), cos = Math.cos(yaw);
      var dx = (-sin * avant + cos * droite);
      var dz = (-cos * avant - sin * droite);
      var norme = Math.sqrt(dx * dx + dz * dz);
      pos.x += (dx / norme) * vitesse * dt;
      pos.z += (dz / norme) * vitesse * dt;
      bob += dt * (course ? 13 : 9);
    } else {
      bob *= 1 - Math.min(dt * 6, 1);
    }

    resoudreCollisions();

    // Limites du monde
    if (partie === 1 || enAttentePartie2) { // enAttentePartie2 : on est encore dans la crypte, avant le clic de transition
      pos.x = Math.max(-95, Math.min(95, pos.x));
      pos.z = Math.max(-117.5, Math.min(95, pos.z)); // la crypte descend jusqu'à z = -120
    } else if (partie === 3) {
      pos.x = Math.max(-18, Math.min(18, pos.x));   // partie 3 : catacombes (x -20..20)
      pos.z = Math.max(399, Math.min(458, pos.z));   // partie 3 : catacombes (z 402..458)
    } else {
      pos.x = Math.max(-28, Math.min(28, pos.x));   // partie 2 : école (x -30..30)
      pos.z = Math.max(276, Math.min(338, pos.z));   // partie 2 : école (z 280..340), on peut sortir par le nord
    }

    // Saut + gravité (hauteur des yeux plus basse quand on est caché sous le lit)
    var hauteurYeux = cache ? 0.45 : AU_SOL;
    var solY = hauteurSol() + hauteurYeux;
    if (enJeu && !cache && keys['Space'] && pos.y <= solY + 0.01) velY = 7.8;
    velY -= 14 * dt;
    pos.y += velY * dt;
    if (pos.y < solY) { pos.y += (solY - pos.y) * Math.min(dt * 6, 1); velY = 0; }

    // Caméra + head bob
    var bobY = Math.sin(bob) * 0.035;
    var bobX = Math.cos(bob * 0.5) * 0.02;
    camera.position.set(pos.x + bobX * Math.cos(yaw), pos.y + bobY, pos.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(yaw);
    camera.rotateX(pitch);

    // Visée au sniper (clic droit maintenu) : lunette affichée, arme cachée, zoom x2
    var viseurActif = viser && enJeu && inventaire.length && inventaire[slotSel].nom === 'Sniper';
    viseurSniperEl.style.display = viseurActif ? 'block' : 'none';
    objetEnMain.visible = !viseurActif; // on ne voit plus l'arme quand on vise
    var fovCible = viseurActif ? 30 : 72; // zoom
    if (Math.abs(camera.fov - fovCible) > 0.05) {
      camera.fov += (fovCible - camera.fov) * Math.min(dt * 12, 1);
      camera.updateProjectionMatrix();
    }
    // ---------- Boss de la crypte ----------
    if (bossApparu && !bossMort && !mort) {
      var bcx = pos.x - bossPos.x, bcz = pos.z - bossPos.z;
      var bd = Math.sqrt(bcx * bcx + bcz * bcz);
      if (bd > 0.01) {
        bossPos.x += (bcx / bd) * 5.2 * dt;
        bossPos.z += (bcz / bd) * 5.2 * dt;
        boss.rotation.y = Math.atan2(bcx, bcz);
      }
      pousserCollisions(bossPos, 0.7);
      bossPos.x = Math.max(-22, Math.min(22, bossPos.x));
      bossPos.z = Math.max(-117, Math.min(-85, bossPos.z)); // le boss reste dans la crypte
      if (bd < 2.4 && !cache) gameOver();
    }

    // ---------- Portail de fin de partie 1 ----------
    if (portailActif && partie === 1 && portail) {
      portailT += dt;
      portail.anneau.rotation.z += dt * 1.4;
      portail.disque.rotation.z -= dt * 2.2;
      portail.disque.material.opacity = 0.45 + Math.sin(portailT * 3) * 0.15;
      portail.lum.intensity = 1.2 + Math.sin(portailT * 3) * 0.4;
      if (distance2D(portail.x, portail.z) < 2.4) entrerDansPortail();
    }

    // ---------- Lumières clignotantes de l'école (partie 2) ----------
    for (var lei = 0; lei < lumieresEcole.length; lei++) {
      lumieresEcole[lei].lum.intensity = lumieresEcole[lei].base * (0.4 + Math.random() * 0.9);
    }

    // ---------- Porte de sortie de l'école : elle monte quand les 3 fils sont alimentés ----------
    if (porteSortieEnCours && porteSortie) {
      porteSortie.position.y += dt * 3;
      if (porteSortie.position.y >= 13.8) { // entièrement relevée au-dessus du mur de 9 m
        porteSortie.position.y = 13.8;
        porteSortieEnCours = false;
        porteSortieOuverte = true;
        var iPS = rects.indexOf(rectPorteSortie);
        if (iPS >= 0) rects.splice(iPS, 1);
        // le trou de la trappe (derrière la porte) devient franchissable
        if (rectTrappe) {
          var iT0 = rects.indexOf(rectTrappe);
          if (iT0 >= 0) rects.splice(iT0, 1);
          rectTrappe = null;
        }
      }
    }

    // la trappe s'ouvre quand on PASSE la porte de sortie (z < 280.5)
    if (partie === 2 && porteSortieOuverte && !trappeOuverte && pos.z < 280.5) {
      trappeOuverte = true; trappeEnCours = true;
      sonScreamer();
      afficherMsg('🕳️ LA TRAPPE S\'OUVRE DERRIÈRE LA PORTE !', 4000);
    }

    // ---------- Trappe de l'école : s'ouvre en grand, puis on peut tomber dedans ----------
    if (trappeOuverte && trappeEnCours && pivotTrappe) {
      pivotTrappe.rotation.z = Math.min(pivotTrappe.rotation.z + dt * 2.2, 1.9);
      if (pivotTrappe.rotation.z >= 1.9) trappeEnCours = false;
      if (pivotTrappe.rotation.z > 0.6 && rectTrappe) { // assez ouverte : le trou est franchissable
        var iT = rects.indexOf(rectTrappe);
        if (iT >= 0) rects.splice(iT, 1);
        rectTrappe = null;
      }
    }
    // le joueur tombe dans la trappe (derrière la porte)
    if (trappeOuverte && !chuteMsg && pos.y > -6 && pos.x > -2.2 && pos.x < 2.2 && pos.z > 274.8 && pos.z < 279.2) {
      chuteMsg = true;
      poursuit = false; stopMusiquePeur(); // le monstre ne te voit plus / ne poursuit plus dans le sous-sol
      sonScreamer();
      missionEl.textContent = '🎯 Partie 2 : ouvre la porte 🚪, prends le sniper 🎯 sur le carré, touche les 5 cibles (0/5) !';
      afficherMsg('🕳️ LA TRAPPE S\'EST OUVERTE — TU TOMBES DANS LE SOUTERRAIN !', 4000);
    }

    // ---------- Porte de l'antichambre du souterrain : monte quand on l'ouvre (E) ----------
    if (porteEntreeEnCours && porteEntree) {
      porteEntree.position.y += dt * 3;
      if (porteEntree.position.y >= 0.6) { // entièrement relevée dans le plafond
        porteEntree.position.y = 0.6;
        porteEntreeEnCours = false;
        var iPE = rects.indexOf(rectPorteEntree);
        if (iPE >= 0) rects.splice(iPE, 1);
      }
    }

    // ---------- Porte de la salle ouest de l'école : tombe quand on l'a cassée au pied de biche ----------
    if (porteCassee && porteAileOuest && porteAileOuestCasseT < 1) {
      porteAileOuestCasseT = Math.min(porteAileOuestCasseT + dt * 2.5, 1);
      porteAileOuest.rotation.z = 1.5 * porteAileOuestCasseT; // bascule à plat
      porteAileOuest.position.y = 3 - 2.8 * porteAileOuestCasseT;
    }

    // ---------- Barrières basses du souterrain : s'enfoncent dans le sol à 5/5 ----------
    if (barrieresBaissent) {
      var resteB = false;
      for (var ib = 0; ib < barrieres.length; ib++) {
        var ba = barrieres[ib];
        if (!ba.ouverte) {
          ba.mesh.position.y -= dt * 2.5;
          if (ba.mesh.position.y <= -13.2) {
            ba.mesh.position.y = -13.2;
            ba.ouverte = true;
            var iR = rects.indexOf(ba.rect);
            if (iR >= 0) rects.splice(iR, 1);
          } else resteB = true;
        }
      }
      if (!resteB) barrieresBaissent = false;
    }

    // ---------- Barrière devant la porte du fond : s'enfonce dans le sol à 5/5 ----------
    if (barriereBaisseEnCours && barrierePorte) {
      barrierePorte.position.y -= dt * 2.5;
      if (barrierePorte.position.y <= -13.6) { // complètement engloutie sous le sol
        barrierePorte.position.y = -13.6;
        barriereBaisseEnCours = false;
        var iBP = rects.indexOf(rectBarrierePorte);
        if (iBP >= 0) rects.splice(iBP, 1);
      }
    }

    // ---------- Porte du fond des catacombes (partie 3) : monte quand on l'ouvre avec la clé ----------
    if (porteCatacombesEnCours && porteCatacombes) {
      porteCatacombes.position.y += dt * 3;
      if (porteCatacombes.position.y >= 10.8) { // relevée au-dessus du mur de 7 m
        porteCatacombes.position.y = 10.8;
        porteCatacombesEnCours = false;
        var iPC2 = rects.indexOf(rectPorteCatacombes);
        if (iPC2 >= 0) rects.splice(iPC2, 1);
      }
    }

    // ---------- Porte du fond du souterrain : monte quand les 5 cibles sont touchées ----------
    if (porteSouterrainEnCours && porteSouterrain) {
      porteSouterrain.position.y += dt * 3;
      if (porteSouterrain.position.y >= 0.2) { // entièrement relevée (mur de 8 m depuis y=-12)
        porteSouterrain.position.y = 0.2;
        porteSouterrainEnCours = false;
        var iPS2 = rects.indexOf(rectPorteSouterrain);
        if (iPS2 >= 0) rects.splice(iPS2, 1);
      }
    }

    // ---------- Barre de vie du boss ----------
    var bossActif = bossApparu && !bossMort;
    bossBarEl.style.display = bossActif ? 'block' : 'none';
    if (bossActif) bossBarFillEl.style.width = Math.max(0, bossPV / bossPVMax * 100) + '%';
    // le bouton rouge pulse tant que le boss n'est pas apparu
    if (crypteOuverte && !bossApparu) {
      boutonT += dt;
      bouton.material.emissiveIntensity = 0.6 + Math.sin(boutonT * 4) * 0.35;
    }

    // Animation d'ouverture de la porte de la crypte : elle pivote sur ses gonds vers l'intérieur
    if (crypteEnCours) {
      pivotCrypte.rotation.y = Math.min(pivotCrypte.rotation.y + dt * 2.0, 1.8);
      if (pivotCrypte.rotation.y >= 1.8) crypteEnCours = false;
      if (!rectCrypteRetire && pivotCrypte.rotation.y > 0.3) { // le passage est dégagé
        rectCrypteRetire = true;
        var iC = rects.indexOf(rectCrypte);
        if (iC >= 0) rects.splice(iC, 1);
      }
    }

    // Bords rouges + léger tremblement quand le monstre poursuit
    document.getElementById('danger').style.opacity = (((poursuit && !monstreMort) || (bossApparu && !bossMort)) && !mort) ? '1' : '0';
    if (poursuit && !mort && !monstreMort) {
      camera.rotateX((Math.random() - 0.5) * 0.02);
      camera.rotateY((Math.random() - 0.5) * 0.02);
    }

    // Animation du coup de pied de biche (0.35 s)
    if (attaqueT >= 0) {
      attaqueT += dt;
      var phase = attaqueT / 0.35;
      if (phase >= 1) {
        attaqueT = -1;
        coupEnfonce = false;
        objetEnMain.rotation.set(0.15, 0.5, -0.25);
        objetEnMain.position.z = -0.5;
      } else {
        var s = Math.sin(phase * Math.PI);
        objetEnMain.rotation.x = 0.15 - s * 1.4;
        objetEnMain.rotation.y = 0.5 - s * 0.6;
        // le coup s'enfonce dans le monstre quand ça touche (prolonge l'arme vers l'avant)
        objetEnMain.position.z = -0.5 - s * 0.3 - (coupEnfonce ? s * 0.28 : 0);
      }
    }

    // Lucioles
    lucioles.rotation.y = t * 0.01;

    // Tremblements : torche du joueur + flammes murales + lueur du pied de biche
    if (torcheOn) torche.intensity = 2.5 + Math.sin(t * 37) * 0.07 + Math.sin(t * 13.7) * 0.06;
    if (!bicheTrouvee) lumBiche.intensity = 0.8 + Math.sin(t * 5) * 0.25;
    if (!cleTrouvee && bicheTrouvee) lumCle.intensity = 0.8 + Math.sin(t * 4.2) * 0.25;

    // Animation d'ouverture des deux coffres (les couvercles basculent)
    if (coffreEnCours) {
      pivotCouvercle.rotation.x -= dt * 2.2;
      if (pivotCouvercle.rotation.x <= -1.9) { pivotCouvercle.rotation.x = -1.9; coffreEnCours = false; }
    }
    if (coffre2EnCours) {
      pivotCouvercle2.rotation.x -= dt * 2.2;
      if (pivotCouvercle2.rotation.x <= -1.9) { pivotCouvercle2.rotation.x = -1.9; coffre2EnCours = false; }
    }

    // Mission 6 : victoire en sortant par la poterne sud (z > E)
    if (partie === 1 && coffreOuvert && !partieGagnee && pos.z > E - 1) gagner();
    // sortie de l'école au nord : uniquement quand on est VRAIMENT dans l'école (z ~ 276..281), pas dans la crypte
    // (on ne gagne plus en sortant de l'école : on tombe dans la trappe derrière la porte)
    // !enAttentePartie3 : ne se déclenche qu'UNE FOIS (sinon exitPointerLock en boucle bloque le re-clic)
    if (partie === 2 && !enAttentePartie2 && !enAttentePartie3 && !partieGagnee && pos.y < -6 && pos.z > 322.5) entrerDansPartie3(); // porte du fond du souterrain → transition animée partie 3
    if (partie === 3 && !partieGagnee && pos.z < 402) gagnerPartie3(); // porte du fond des catacombes → victoire finale

    // Animation d'ouverture de la porte du donjon (elle se soulève)
    if (porteEnCours) {
      porte.position.y += dt * 3.2;
      if (porte.position.y >= 16.6) { // la porte (16 m de haut) est entièrement relevée
        porteEnCours = false;
        var idx = rects.indexOf(rectPorte);
        if (idx >= 0) rects.splice(idx, 1); // la porte ne bloque plus le passage
      }
    }
    for (var f = 0; f < flammes.length; f++) {
      var fl = flammes[f];
      // torches murales éteintes aussi quand la lampe torche est off
      fl.lum.intensity = torcheOn ? 1.0 + Math.sin(t * 11 + f * 2.3) * 0.25 + Math.sin(t * 29 + f) * 0.12 : 0;
      fl.flamme.scale.setScalar(1 + Math.sin(t * 17 + f * 3.1) * 0.25);
      fl.flamme.visible = torcheOn;
    }

    // Invite contextuelle (E : ...) quand on est près d'un objet ou d'une porte
    var prompt = '';
    for (var cp = 0; cp < conteneursMunitions.length; cp++) {
      var ctp = conteneursMunitions[cp];
      if (!ctp.pris && distance2D(ctp.x, ctp.z) < 3) { prompt = 'E : fouiller la caisse (+2 balles)'; break; }
    }
    if (prompt === '' && !bicheTrouvee && distance2D(piedDeBiche.position.x, piedDeBiche.position.z) < 4.4) {
      prompt = 'E : ramasser le pied de biche';
    } else if (!cleTrouvee && bicheTrouvee && distance2D(cle.position.x, cle.position.z) < 4.8) {
      prompt = 'E : chercher la clé (regarde en haut de l\'étagère)';
    } else if (!livrePris && distance2D(livre.position.x, livre.position.z) < 4.8) {
      prompt = 'E : prendre le livre du code 📖';
    } else if (!coffreOuvert && distance2D(-18, -60) < 3.5) {
      prompt = aObjet('Livre du code (7-3-9-2)') ? 'E : ouvrir le digicode du coffre' : '🔒 Coffre verrouillé — il te faut le code du livre';
    } else if (!pistoletPris && coffreOuvert && distance2D(-18, -60) < 3.5) {
      prompt = 'E : prendre le pistolet 🔫 (5 balles)';
    } else if (coffre2Ouvert && !cristalPris && distance2D(18, -60) < 3.5) {
      prompt = 'E : prendre le cristal vert 💚 (coffre est)';
    } else if (!crypteOuverte && distance2D(0, -E) < 5.2) {
      prompt = aObjet('Cristal vert') ? 'E : ouvrir la crypte avec le cristal 💚' : '🔒 Porte de la crypte — il te faut le cristal vert';
    } else if (crypteOuverte && !bossApparu && distance2D(0, -102) < 4.5) {
      prompt = 'E : appuyer sur le bouton rouge au centre de la crypte';
    } else if (portailActif && partie === 1 && portail && distance2D(portail.x, portail.z) < 7) {
      prompt = '🌀 Marche dans le portail violet !';
    } else if (partie === 2 && pos.y < -6 && !porteEntreeOuverte && distance2D(0, 281) < 8) {
      prompt = 'E : ouvrir la porte 🚪';
    } else if (partie === 2 && pos.y < -6 && ciblesTouchees < 5 && distance2D(0, 320) < 8) {
      prompt = '🔒 Barrière — touche d\'abord les 5 cibles 🎯 (' + ciblesTouchees + '/5)';
    } else if (partie === 3 && !cleCatacombesPrise && distance2D(-18.5, 428) < 3.5) {
      prompt = 'E : prendre la clé des catacombes 🔑';
    } else if (partie === 3 && !porteCatacombesOuverte && distance2D(0, 402) < 5) {
      prompt = aObjet('Clé des catacombes') ? 'E : ouvrir la porte du fond 🚪' : '🔒 Porte du fond — il te faut la clé des catacombes 🔑';
    } else if (partie === 2 && !sniperPris && pos.y < -6 && distance2D(3.5, 277) < 3.5) {
      prompt = 'E : prendre le sniper 🎯';
    } else if (partie === 2 && pos.y > -6 && !porteCassee && distance2D(-8, 310) < 5) {
      prompt = aObjet('Pied de biche') ? '🔨 Clic gauche : casser la porte de la salle ouest' : '🔒 Porte coincée — il te faut un pied de biche';
    } else if (partie === 2 && pos.y > -6 && filsAlimentes < 3 && boitierProche()) {
      prompt = 'E : alimenter le fil électrique ⚡ (' + filsAlimentes + '/3)';
    } else if (partie === 2 && pos.y > -6 && filsAlimentes >= 3 && pos.z < 292) {
      prompt = '🚪 Passe la porte au nord (attention derrière !)';
    } else if (partie === 2 && pos.y > -6 && pos.z < 292) {
      prompt = '🔒 Porte verrouillée — il faut alimenter les 3 fils ⚡';
    } else if (!porteOuverte && distance2D(0, DZ) < 5.2) {
      prompt = aObjet('Clé rouillée') ? 'E : ouvrir la porte du donjon' : '🔒 Porte verrouillée — il te faut une clé';
    } else if (distance2D(litPos.x, litPos.z) < 5.6) {
      prompt = cache ? 'C : sortir du dessous du lit' : 'C : se cacher sous le lit';
    }
    // ---------- Mise à jour des balles (tracers) et du flash ----------
    if (flashTirT > 0) { flashTirT -= dt; flashTir.intensity = 5; } else flashTir.intensity = 0;
    for (var bl = balles.length - 1; bl >= 0; bl--) {
      var balle = balles[bl];
      var step = 60 * dt;
      balle.mesh.position.add(balle.dir.clone().multiplyScalar(step));
      balle.dist += step;
      // touche le monstre ?
      if (!monstreMort) {
        var ddx = balle.mesh.position.x - monstrePos.x;
        var ddy = balle.mesh.position.y - 1.4;
        var ddz = balle.mesh.position.z - monstrePos.z;
        if (ddx * ddx + ddy * ddy + ddz * ddz < 0.5) {
          sang(monstrePos.x, 1.6, monstrePos.z);
          tacheSang(monstrePos.x, monstrePos.z);
          pvMonstre = 0; tuerMonstre();
        }
      }
      // touche une cible rouge du souterrain (partie 2) ?
      if (partie === 2 && pos.y < -6) {
        for (var ci = 0; ci < cibles.length; ci++) {
          var cb = cibles[ci];
          if (!cb.touchee) {
            var dx = balle.mesh.position.x - cb.pos.x, dy = balle.mesh.position.y - cb.pos.y, dz = balle.mesh.position.z - cb.pos.z;
            if (dx * dx + dy * dy + dz * dz < 1.3) { // rayon de touche élargi
              cb.touchee = true;
              cb.mesh.material.color.setHex(0x2bff6a); // la cible passe au vert
              sang(cb.pos.x, cb.pos.y, cb.pos.z);
              ciblesTouchees++;
              sonZap();
              if (ciblesTouchees >= 5) {
                porteSouterrainEnCours = true;
                barriereBaisseEnCours = true; // la barrière devant la porte s'enfonce
                barrieresBaissent = true;    // les barrières autour des cibles s'enfoncent aussi
                porteSouterrain.userData.lampe.material.color.setHex(0x2bff6a);
                missionEl.textContent = '🚪 5/5 cibles ! La porte du fond du souterrain s\'ouvre — sors !';
                afficherMsg('🚪 5/5 CIBLES ! LA PORTE DU SOUTERRAIN S\'OUVRE !', 5000);
              } else {
                missionEl.textContent = '🎯 Partie 2 : cibles touchées ' + ciblesTouchees + '/5 — encore ' + (5 - ciblesTouchees) + ' !';
                afficherMsg('🎯 Cible touchée ! (' + ciblesTouchees + '/5)', 2500);
              }
              break;
            }
          }
        }
      }
      // touche le boss ?
      if (bossApparu && !bossMort) {
        var ex = balle.mesh.position.x - bossPos.x;
        var ey = balle.mesh.position.y - 1.9;
        var ez = balle.mesh.position.z - bossPos.z;
        if (ex * ex + ey * ey + ez * ez < 1.4) {
          bossPV--;
          sang(bossPos.x, 1.9, bossPos.z);
          tacheSang(bossPos.x, bossPos.z);
          if (bossPV <= 0) {
            bossMort = true; scene.remove(boss);
            stopMusiquePeur(); // fin de la musique d'angoisse du boss
            missionEl.textContent = '🎯 Mission 10 : sors du château par la poterne sud !';
            afficherMsg('✔ Le boss de la crypte est tué !', 4000);
            // Fin de la partie 1 : le portail apparaît DANS la salle du boss (la crypte), là où il meurt
            if (partie === 1 && !portailActif) {
              var tmpB = { x: bossPos.x, z: bossPos.z };
              pousserCollisions(tmpB, 2.6); // le portail n'apparaît pas dans un mur
              tmpB.x = Math.max(-21, Math.min(21, tmpB.x));
              tmpB.z = Math.max(-116, Math.min(-87, tmpB.z));
              creerPortail(tmpB.x, tmpB.z);
              portailActif = true;
              missionEl.textContent = '🌀 Bravo ! Partie 1 terminée — entre dans le portail violet !';
              afficherMsg('🏆 Bravo ! Vous avez terminé la première partie !', 6000);
            }
          }
        }
      }
      if (balle.dist > 45) { scene.remove(balle.mesh); balles.splice(bl, 1); }
    }

    // ---------- Mise à jour des particules de sang ----------
    for (var gp = gerbes.length - 1; gp >= 0; gp--) {
      var gb = gerbes[gp];
      gb.life -= dt;
      if (gb.life <= 0) {
        scene.remove(gb.tache ? gb.tacheM : gb.pts);
        gerbes.splice(gp, 1);
        continue;
      }
      if (gb.tache) {
        gb.mat.opacity = Math.min(0.9, gb.life / 25 * 0.9); // la tache reste longtemps
      } else {
        var posAttr = gb.pts.geometry.attributes.position;
        for (var pi = 0; pi < gb.vel.length; pi++) {
          gb.vel[pi][1] -= 9 * dt; // gravité
          posAttr.setXYZ(pi,
            posAttr.getX(pi) + gb.vel[pi][0] * dt,
            Math.max(0.02, posAttr.getY(pi) + gb.vel[pi][1] * dt),
            posAttr.getZ(pi) + gb.vel[pi][2] * dt);
        }
        posAttr.needsUpdate = true;
        gb.mat.opacity = gb.life / 0.9;
      }
    }

    // ---------- Portes des ailes : s'ouvrent quand on s'approche (joueur ou monstre) ----------
    for (var pd = 0; pd < portesPivot.length; pd++) {
      var porteP = portesPivot[pd];
      if (!porteP.ouvert) {
        var dJ = Math.sqrt((pos.x - porteP.cx) * (pos.x - porteP.cx) + (pos.z - porteP.cz) * (pos.z - porteP.cz));
        var dM = Math.sqrt((monstrePos.x - porteP.cx) * (monstrePos.x - porteP.cx) + (monstrePos.z - porteP.cz) * (monstrePos.z - porteP.cz));
        if (dJ < 4.5 || dM < 4.5) porteP.ouvert = true;
      }
      if (porteP.ouvert && porteP.angle > -1.7) {
        porteP.angle -= dt * 2.5;
        porteP.pivot.rotation.y = porteP.angle * porteP.cote;
        if (porteP.angle <= -1.7) {
          var iR = rects.indexOf(porteP.rect);
          if (iR >= 0) rects.splice(iR, 1); // la porte ne bloque plus
        }
      }
    }

    // ---------- IA du monstre ----------
    if (!mort && !monstreMort) {
      var mdx = pos.x - monstrePos.x, mdz = pos.z - monstrePos.z;
      var distJ = Math.sqrt(mdx * mdx + mdz * mdz);
      if (stunT > 0) {
        // étourdi par un coup de pied de biche : il ne bouge plus
        stunT -= dt;
        lumRouge.intensity = 2.5;
      } else {
        var poursuitAvant = poursuit;
        poursuit = !cache && distJ < 16 && pos.y > -6; // il te repère à moins de 16 m, sauf si tu es caché OU dans le sous-sol
        if (poursuit && !poursuitAvant) { sonGrowl(); startMusiquePeur(); } // grognement + musique d'angoisse
        if (!poursuit && poursuitAvant) stopMusiquePeur(); // la musique s'arrête quand il te perd
        if (poursuit) {
          cibleMonstre.set(pos.x, 0, pos.z);
        } else if (Math.abs(cibleMonstre.x - monstrePos.x) < 2 && Math.abs(cibleMonstre.z - monstrePos.z) < 2) {
          if (partie === 1 || enAttentePartie2) cibleMonstre.set((Math.random() * 2 - 1) * 76, 0, (Math.random() * 2 - 1) * 76);
          else if (partie === 3) cibleMonstre.set((Math.random() * 2 - 1) * 16, 0, 406 + Math.random() * 48); // partie 3 : catacombes
          else cibleMonstre.set((Math.random() * 2 - 1) * 26, 0, 284 + Math.random() * 52); // partie 2 : il rôde dans l'école
        }
        var vx = cibleMonstre.x - monstrePos.x, vz = cibleMonstre.z - monstrePos.z;
        var vn = Math.sqrt(vx * vx + vz * vz);
        if (vn > 0.01) {
          var v = poursuit ? ((porteOuverte || partie === 3) ? 6.5 : 5.5) : 3.0; // bien plus rapide (très rapide dans les catacombes)
          var oldX = monstrePos.x, oldZ = monstrePos.z;
          monstrePos.x += (vx / vn) * v * dt;
          monstrePos.z += (vz / vn) * v * dt;
          monstre.rotation.y = Math.atan2(vx, vz); // il te fait face
          pousserCollisions(monstrePos, 0.5); // il ne traverse pas les murs
          // Anti-blocage : s'il avance à peine (mur / porte), il part sur le côté pour contourner
          var avance = Math.sqrt((monstrePos.x - oldX) * (monstrePos.x - oldX) + (monstrePos.z - oldZ) * (monstrePos.z - oldZ));
          if (avance < v * dt * 0.25) stuckT += dt; else stuckT = 0;
          if (stuckT > 0.4) {
            stuckT = 0;
            var px = -vz / vn, pz = vx / vn; // direction perpendiculaire
            var cote = Math.random() < 0.5 ? 1 : -1;
            cibleMonstre.set(monstrePos.x + px * cote * 14, 0, monstrePos.z + pz * cote * 14);
          }
        }
        if (partie === 1 || enAttentePartie2) {
          monstrePos.x = Math.max(-100, Math.min(100, monstrePos.x));
          monstrePos.z = Math.max(-100, Math.min(100, monstrePos.z));
        } else if (partie === 3) {
          monstrePos.x = Math.max(-18, Math.min(18, monstrePos.x));
          monstrePos.z = Math.max(404, Math.min(456, monstrePos.z));
        } else {
          monstrePos.x = Math.max(-28, Math.min(28, monstrePos.x));
          monstrePos.z = Math.max(282, Math.min(338, monstrePos.z));
        }
        // Yeux rouges qui brillent plus fort quand il poursuit
        lumRouge.intensity = poursuit ? 2.2 + Math.sin(t * 8) * 0.5 : 0.9;
        // Il t'attrape = mort (impossible si tu es caché sous le lit)
        if (distJ < 2.2 && !cache && pos.y > -6) gameOver(); // jamais mort dans le sous-sol (distance 3D)
      }
      // Animation zombie : démarche saccadée, balancement du torse, bras tendus, tête qui ballotte
      monstre.position.y = Math.abs(Math.sin(t * 2.6)) * 0.05;
      jambeG.rotation.x = Math.sin(t * 2.6) * 0.5;
      jambeD.rotation.x = -Math.sin(t * 2.6) * 0.5;
      torse.rotation.z = Math.sin(t * 2.6) * 0.06; // balancement latéral
      teteM.rotation.z = Math.sin(t * 1.1) * 0.16;
      brasMG.rotation.x = -1.35 + Math.sin(t * 2.6) * 0.1;
      brasMD.rotation.x = -1.35 - Math.sin(t * 2.6) * 0.1;
      // Flash blanc quand il prend un coup
      if (hitFlash > 0) {
        hitFlash -= dt;
        lumRouge.color.setHex(0xffffff);
        matYeux.color.setHex(0xffffff);
      } else {
        lumRouge.color.setHex(0xff2222);
        matYeux.color.setHex(0xff2222);
      }
    }

    // La serrure pulse quand on a la clé et qu'on est près de la porte
    if (!porteOuverte && distance2D(0, DZ) < 4) {
      var aCle = aObjet('Clé rouillée');
      serrureMat.emissive.setHex(aCle ? 0xaa7700 : 0x000000);
      serrureMat.emissiveIntensity = aCle ? 1.5 + Math.sin(t * 6) * 0.8 : 0;
    } else if (!porteOuverte) {
      serrureMat.emissive.setHex(0x000000);
    }
    var promptEl = document.getElementById('prompt');
    if (promptEl.textContent !== prompt) promptEl.textContent = prompt;
    promptEl.style.display = prompt ? 'block' : 'none';

    dessinerCarte();
    renderer.render(scene, camera);
  }
  boucle();

  // ---------- Hook de test (Playwright) ----------
  // Expose l'état interne du jeu UNIQUEMENT pour les tests automatisés
  // (tests/horreur.spec.js). Aucun effet sur le gameplay normal.
  window.__jeu = {
    get enJeu() { return enJeu; }, set enJeu(v) { enJeu = v; },
    get mort() { return mort; }, set mort(v) { mort = v; },
    get cache() { return cache; }, set cache(v) { cache = v; },
    get pos() { return pos; },
    get yaw() { return yaw; }, set yaw(v) { yaw = v; },
    get pitch() { return pitch; }, set pitch(v) { pitch = v; },
    set velY(v) { velY = v; },
    get keys() { return keys; },
    get inventaire() { return inventaire; },
    get slotSel() { return slotSel; }, set slotSel(v) { slotSel = v; },
    get munitions() { return munitions; }, set munitions(v) { munitions = v; },
    get bicheTrouvee() { return bicheTrouvee; },
    get cleTrouvee() { return cleTrouvee; },
    get cle() { return cle; },
    get livrePris() { return livrePris; },
    get coffreOuvert() { return coffreOuvert; },
    get coffre2Ouvert() { return coffre2Ouvert; },
    get pistoletPris() { return pistoletPris; },
    get cristalPris() { return cristalPris; },
    get porteOuverte() { return porteOuverte; },
    get porte() { return porte; },
    get crypteOuverte() { return crypteOuverte; },
    get rectCrypteRetire() { return rectCrypteRetire; },
    get bossApparu() { return bossApparu; },
    get bossMort() { return bossMort; },
    get bossPV() { return bossPV; },
    get portailActif() { return portailActif; },
    get monstreMort() { return monstreMort; }, set monstreMort(v) { monstreMort = v; },
    get monstre() { return monstre; },
    get conteneursMunitions() { return conteneursMunitions; },
    get rects() { return rects; },
    get cercles() { return cercles; },
    get portesPivot() { return portesPivot; },
    get scene() { return scene; },
    get renderer() { return renderer; },
    get camera() { return camera; },
    interagir: interagir
  };
})();
