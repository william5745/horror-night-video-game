// Mine 3D — rendu Three.js : vue première personne, textures détaillées, marchand, inventaire
(function () {
  'use strict';

  var L = window.LOGIQUE;
  var etat = L.etat;

  // ---------- Scène ----------
  var conteneur = document.getElementById('scene');
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  conteneur.appendChild(renderer.domElement);
  var canvas = renderer.domElement;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 40, 110);

  var camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.0));
  var soleil = new THREE.DirectionalLight(0xfff5e0, 0.8);
  soleil.position.set(18, 35, 14);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  soleil.shadow.camera.left = -25;
  soleil.shadow.camera.right = 25;
  soleil.shadow.camera.top = 25;
  soleil.shadow.camera.bottom = -25;
  soleil.shadow.camera.far = 80;
  scene.add(soleil);
  scene.add(soleil.target);

  var solLointain = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshLambertMaterial({ color: 0x3f7a3a })
  );
  solLointain.rotation.x = -Math.PI / 2;
  solLointain.position.y = -25;
  solLointain.receiveShadow = true;
  scene.add(solLointain);

  var nuages = [];
  for (var i = 0; i < 10; i++) {
    var n = new THREE.Mesh(
      new THREE.BoxGeometry(6 + Math.random() * 8, 0.6, 4 + Math.random() * 5),
      new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
    );
    n.position.set(Math.random() * 120 - 60, 22 + Math.random() * 8, Math.random() * 120 - 60);
    scene.add(n);
    nuages.push(n);
  }

  // ---------- Textures procédurales haute définition (256 px) ----------
  function creerTexture(dessiner, taille) {
    taille = taille || 256;
    var c = document.createElement('canvas');
    c.width = c.height = taille;
    var ctx = c.getContext('2d');
    dessiner(ctx, taille);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  function base(ctx, s, couleur) {
    ctx.fillStyle = couleur;
    ctx.fillRect(0, 0, s, s);
  }

  function grain(ctx, s, couleurs, n, tMin, tMax) {
    for (var i = 0; i < n; i++) {
      ctx.fillStyle = couleurs[Math.floor(Math.random() * couleurs.length)];
      var t = tMin + Math.random() * (tMax - tMin);
      ctx.fillRect(Math.floor(Math.random() * s), Math.floor(Math.random() * s), t, t);
    }
  }

  // Cailloux : petits disques avec ombre et reflet (donne du relief)
  function cailloux(ctx, s, n, couleur, ombre, reflet) {
    for (var i = 0; i < n; i++) {
      var x = Math.random() * s, y = Math.random() * s, r = 2 + Math.random() * 4;
      ctx.fillStyle = ombre;
      ctx.beginPath(); ctx.arc(x + 1, y + 1, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = couleur;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = reflet;
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2); ctx.fill();
    }
  }

  function fissures(ctx, s, n, couleur) {
    ctx.strokeStyle = couleur;
    for (var i = 0; i < n; i++) {
      ctx.lineWidth = 1 + Math.random() * 1.5;
      ctx.beginPath();
      var x = Math.random() * s, y = Math.random() * s;
      ctx.moveTo(x, y);
      for (var j = 0; j < 4; j++) {
        x += (Math.random() - 0.5) * s * 0.25;
        y += Math.random() * s * 0.2;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  function vignette(ctx, s, alpha) {
    var g = ctx.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + alpha + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }

  function peindrePierre(ctx, s) {
    base(ctx, s, '#8f8f8f');
    // strates horizontales
    for (var y = 0; y < s; y += 8 + Math.random() * 14) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, y, s, 4 + Math.random() * 8);
    }
    grain(ctx, s, ['#7c7c7c', '#a3a3a3', '#858585', '#9a9a9a', '#6f6f6f'], s * 3, 2, 5);
    fissures(ctx, s, 6, 'rgba(60,60,60,0.55)');
    cailloux(ctx, s, 5, '#7a7a7a', 'rgba(0,0,0,0.25)', 'rgba(255,255,255,0.25)');
    vignette(ctx, s, 0.12);
  }

  function peindreMinerai(ore, reflet, extra) {
    return function (ctx, s) {
      peindrePierre(ctx, s);
      // pépites en relief : ombre + corps + reflet brillant
      for (var i = 0; i < 7; i++) {
        var x = Math.floor(Math.random() * (s - 14)) + 4;
        var y = Math.floor(Math.random() * (s - 14)) + 4;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x + 2, y + 2, 8, 8);
        ctx.fillStyle = ore;
        ctx.fillRect(x, y, 8, 8);
        ctx.fillRect(x - 2, y + 1, 3, 6);
        ctx.fillRect(x + 1, y - 2, 6, 3);
        ctx.fillStyle = reflet;
        ctx.fillRect(x + 1, y + 1, 3, 3);
        if (extra) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + 5, y, 2, 2);
        }
      }
    };
  }

  function peindreTerre(ctx, s) {
    base(ctx, s, '#8a5a33');
    grain(ctx, s, ['#6e4525', '#a06a3f', '#5d3a1e', '#96653a'], s * 2, 2, 4);
    grain(ctx, s, ['rgba(0,0,0,0.12)', 'rgba(255,220,170,0.10)'], s * 2.5, 4, 10);
    cailloux(ctx, s, 8, '#7c5a36', 'rgba(0,0,0,0.3)', 'rgba(255,230,190,0.35)');
    vignette(ctx, s, 0.14);
  }

  function peindreHerbeDessus(ctx, s) {
    base(ctx, s, '#5da244');
    grain(ctx, s, ['#4c8a37', '#6cb354', '#3e7a2e', '#55994a'], s * 2.5, 2, 4);
    // brins d'herbe
    ctx.fillStyle = '#3e7a2e';
    for (var i = 0; i < s; i++) {
      var x = Math.random() * s, y = Math.random() * s;
      ctx.fillRect(x, y, 2, 4 + Math.random() * 4);
    }
    vignette(ctx, s, 0.10);
  }

  function peindreHerbeCote(ctx, s) {
    peindreTerre(ctx, s);
    ctx.fillStyle = '#5da244';
    ctx.fillRect(0, 0, s, s * 0.24);
    grain(ctx, s, ['#4c8a37', '#6cb354'], s * 0.6, 2, 4);
    // bord irrégulier + quelques brins qui dépassent
    ctx.fillStyle = '#8a5a33';
    for (var x = 0; x < s; x += 4) {
      if (Math.random() < 0.5) ctx.fillRect(x, s * 0.24, 4, 3 + Math.random() * 6);
    }
    ctx.fillStyle = '#4c8a37';
    for (var i = 0; i < 12; i++) {
      ctx.fillRect(Math.random() * s, s * 0.24, 2, 3 + Math.random() * 5);
    }
  }

  var texTerre = creerTexture(peindreTerre);
  var texHerbeDessus = creerTexture(peindreHerbeDessus);
  var texHerbeCote = creerTexture(peindreHerbeCote);
  var texPierre = creerTexture(peindrePierre);
  var texCuivre = creerTexture(peindreMinerai('#c47b3a', '#f0b070', false));
  var texFer = creerTexture(peindreMinerai('#d8af93', '#f5dcc8', false));
  var texOr = creerTexture(peindreMinerai('#f7d54d', '#fff3a0', true));
  var texDiamant = creerTexture(peindreMinerai('#5ff0e8', '#c8fffb', true));

  var TEXTURES = [texTerre, texPierre, texCuivre, texFer, texOr, texDiamant];
  var COULEURS_BOTTES = [0x8d8d8d, 0x8b5a2b, 0xc0c0c8, 0x4de8e8];
  var COULEURS_PEPITES = { cuivre: 0xc47b3a, fer: 0xd8af93, or: 0xf7d54d, diamant: 0x5ff0e8 };

  // ---------- Blocs ----------
  var meshes = {};
  var geoBoite = new THREE.BoxGeometry(1, 1, 1);
  var geoOctaedre = new THREE.OctahedronGeometry(0.72);

  function estExpose(x, y, z) {
    return !L.blocEn(x + 1, y, z) || !L.blocEn(x - 1, y, z) ||
           !L.blocEn(x, y + 1, z) || !L.blocEn(x, y - 1, z) ||
           !L.blocEn(x, y, z + 1) || !L.blocEn(x, y, z - 1);
  }

  function materiauTexture(tex) {
    var m = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
    m.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.06); // légère variation par bloc
    return m;
  }

  function creerMeshBloc(x, y, z) {
    var b = L.blocEn(x, y, z);
    if (!b) return null;
    var def = L.BLOCS[b.type];
    var materiau;
    if (b.type === 0 && y === 0) {
      var cote = materiauTexture(texHerbeCote);
      materiau = [cote, cote, materiauTexture(texHerbeDessus), materiauTexture(texTerre), cote, cote];
    } else {
      materiau = materiauTexture(TEXTURES[b.type]);
    }
    var m = new THREE.Mesh(def.forme === 'octaedre' ? geoOctaedre : geoBoite, materiau);
    m.position.set(x + 0.5, y + 0.5, z + 0.5);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData = { x: x, y: y, z: z, secousse: 0 };
    m.visible = estExpose(x, y, z);
    scene.add(m);
    meshes[L.cle(x, y, z)] = m;
    return m;
  }

  function creerTousLesMeshes() {
    for (var k in etat.blocs) {
      var p = k.split(',');
      creerMeshBloc(parseInt(p[0], 10), parseInt(p[1], 10), parseInt(p[2], 10));
    }
  }

  function creerNiveau(y) {
    for (var x = 0; x < L.TX; x++) {
      for (var z = 0; z < L.TZ; z++) {
        if (L.blocEn(x, y, z)) creerMeshBloc(x, y, z);
      }
    }
  }

  function rafraichirVisibiliteAutour(x, y, z) {
    var dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    dirs.forEach(function (d) {
      var m = meshes[L.cle(x + d[0], y + d[1], z + d[2])];
      if (m) m.visible = estExpose(x + d[0], y + d[1], z + d[2]);
    });
  }

  function chaqueMateriau(mesh, fn) {
    if (Array.isArray(mesh.material)) mesh.material.forEach(fn);
    else fn(mesh.material);
  }

  function assombrir(mesh) {
    chaqueMateriau(mesh, function (mat) { mat.color.offsetHSL(0, 0, -0.08); });
  }

  function surligner(mesh, on) {
    chaqueMateriau(mesh, function (mat) { mat.emissive.setHex(on ? 0x2a2a2a : 0x000000); });
  }

  // ---------- Personnage ----------
  var joueur = new THREE.Group();
  var jambeG = new THREE.Group();
  jambeG.position.set(-0.14, 0.7, 0);
  var meshJambeG = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.2), new THREE.MeshLambertMaterial({ color: 0x333355 }));
  meshJambeG.position.y = -0.35;
  meshJambeG.castShadow = true;
  jambeG.add(meshJambeG);
  var jambeD = jambeG.clone();
  jambeD.position.x = 0.14;
  var torse = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.3), new THREE.MeshLambertMaterial({ color: 0x2255cc }));
  torse.position.y = 1.025;
  torse.castShadow = true;
  var tete = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
  tete.position.y = 1.575;
  tete.castShadow = true;
  var oeilG = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  oeilG.position.set(-0.1, 1.6, 0.215);
  var oeilD = oeilG.clone();
  oeilD.position.x = 0.1;
  var brasG = new THREE.Group();
  brasG.position.set(-0.36, 1.28, 0);
  var meshBrasG = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.15), new THREE.MeshLambertMaterial({ color: 0x1a4499 }));
  meshBrasG.position.y = -0.25;
  brasG.add(meshBrasG);
  var brasD = new THREE.Group();
  brasD.position.set(0.36, 1.28, 0);
  var manchePerso = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.65, 0.07), new THREE.MeshLambertMaterial({ color: 0x7a5230 }));
  manchePerso.position.y = -0.2;
  var tetePioche = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.14), new THREE.MeshLambertMaterial({ color: L.PIOCHES[etat.pioche].couleur }));
  tetePioche.position.y = -0.52;
  brasD.add(manchePerso);
  brasD.add(tetePioche);
  joueur.add(jambeG, jambeD, torse, tete, oeilG, oeilD, brasG, brasD);
  joueur.position.set(L.TX / 2, 1, L.TZ / 2);
  scene.add(joueur);

  // Pioche en vue subjective
  var vuePioche = new THREE.Group();
  vuePioche.position.set(0.45, -0.42, -0.75);
  var mancheVue = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.05), new THREE.MeshLambertMaterial({ color: 0x7a5230 }));
  mancheVue.position.y = -0.15;
  var teteVue = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.1), new THREE.MeshLambertMaterial({ color: L.PIOCHES[etat.pioche].couleur }));
  teteVue.position.y = -0.42;
  vuePioche.add(mancheVue);
  vuePioche.add(teteVue);
  camera.add(vuePioche);

  function majCouleurPioche() {
    tetePioche.material.color.setHex(L.PIOCHES[etat.pioche].couleur);
    teteVue.material.color.setHex(L.PIOCHES[etat.pioche].couleur);
  }

  // ---------- Le marchand (PNJ avec son étal) ----------
  var POS_MARCHAND = { x: L.TX - 1.5, z: L.TZ - 1.5 };
  var marchand = new THREE.Group();
  var robe = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.1, 0.45), new THREE.MeshLambertMaterial({ color: 0x6b3fa0 }));
  robe.position.y = 0.55;
  robe.castShadow = true;
  var teteM = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
  teteM.position.y = 1.32;
  var chapeau = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.55), new THREE.MeshLambertMaterial({ color: 0x3a2a55 }));
  chapeau.position.y = 1.6;
  var oeilM1 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  oeilM1.position.set(-0.1, 1.36, 0.215);
  var oeilM2 = oeilM1.clone();
  oeilM2.position.x = 0.1;
  marchand.add(robe, teteM, chapeau, oeilM1, oeilM2);
  marchand.position.set(POS_MARCHAND.x, 1, POS_MARCHAND.z);
  scene.add(marchand);

  // Étal : comptoir + poteaux + toit
  var etal = new THREE.Group();
  var comptoir = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.8), new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
  comptoir.position.set(0, 0.45, -1.3);
  comptoir.castShadow = true;
  comptoir.receiveShadow = true;
  var toit = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 2.2), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  toit.position.set(0, 2.3, -0.6);
  toit.castShadow = true;
  var poteau1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.3, 0.1), new THREE.MeshLambertMaterial({ color: 0x5d3a1e }));
  poteau1.position.set(-1.1, 1.15, -1.6);
  var poteau2 = poteau1.clone();
  poteau2.position.x = 1.1;
  etal.add(comptoir, toit, poteau1, poteau2);
  etal.position.set(POS_MARCHAND.x, 1, POS_MARCHAND.z);
  scene.add(etal);

  // Étiquette flottante "MARCHAND"
  (function () {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 8, 256, 48);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MARCHAND', 128, 42);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
    sp.scale.set(2.4, 0.6, 1);
    sp.position.set(POS_MARCHAND.x, 3.1, POS_MARCHAND.z);
    scene.add(sp);
  })();

  // ---------- Physique ----------
  var HX = 0.28, HZ = 0.28, HAUT = 1.7, OEIL = 1.6;
  var vitesseY = 0;
  var auSol = false;
  var GRAVITE = 25, VITESSE_MAX_CHUTE = 18, IMPULSION_SAUT = 9;

  function chevauche(px, py, pz) {
    var x0 = Math.floor(px - HX), x1 = Math.floor(px + HX);
    var y0 = Math.floor(py), y1 = Math.floor(py + HAUT);
    var z0 = Math.floor(pz - HZ), z1 = Math.floor(pz + HZ);
    for (var x = x0; x <= x1; x++) {
      for (var y = y0; y <= y1; y++) {
        for (var z = z0; z <= z1; z++) {
          if (L.blocEn(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  // ---------- Fragments ----------
  var fragments = [];

  function spawnFragments(position, couleur) {
    for (var i = 0; i < 10; i++) {
      var f = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.MeshLambertMaterial({ color: couleur })
      );
      f.position.copy(position);
      f.userData.vitesse = new THREE.Vector3(
        (Math.random() - 0.5) * 5, Math.random() * 5 + 2, (Math.random() - 0.5) * 5
      );
      f.userData.duree = 0.8;
      scene.add(f);
      fragments.push(f);
    }
  }

  // ---------- HUD ----------
  function ajouterJournal(msg) {
    var j = document.getElementById('journal');
    var div = document.createElement('div');
    div.textContent = msg;
    j.prepend(div);
    while (j.children.length > 25) j.removeChild(j.lastChild);
  }

  function rafraichirInventaire() {
    var div = document.getElementById('inventaire');
    div.innerHTML = '';
    L.INVENTAIRE_CLE.forEach(function (cleInv) {
      var n = etat.inventaire[cleInv] || 0;
      var span = document.createElement('span');
      span.className = 'pepite';
      var pastille = document.createElement('span');
      pastille.className = 'pastille';
      pastille.style.background = '#' + COULEURS_PEPITES[cleInv].toString(16).padStart(6, '0');
      span.appendChild(pastille);
      span.appendChild(document.createTextNode(L.NOMS_PEPITES[cleInv].replace('Pépite de ', '').replace('Pépite d’', '') + ' x' + n));
      div.appendChild(span);
    });
  }

  function rafraichirHUD() {
    document.getElementById('pieces').textContent = etat.pieces;
    document.getElementById('profondeur').textContent = etat.profondeur;
    document.getElementById('piocheNom').textContent = L.PIOCHES[etat.pioche].nom;
    document.getElementById('bottesNom').textContent = L.BOTTES[etat.bottes].nom;
    document.getElementById('soldeMenu').textContent = etat.pieces;
    document.getElementById('soldeMarchand').textContent = etat.pieces;
    rafraichirInventaire();
    if (boutiqueOuverte) rafraichirCartes();
    if (marchandOuvert) rafraichirCartesMarchand();
  }

  // ---------- Boutique (achat d'équipement) ----------
  var boutiqueOuverte = false;
  var menuBoutique = document.getElementById('menuBoutique');

  function hex(couleur) {
    return '#' + couleur.toString(16).padStart(6, '0');
  }

  function creerCarte(liste, i, statTexte, couleur, possedeFn, equipeeFn, acheterFn) {
    var def = liste[i];
    var possede = possedeFn(i);
    var equipee = equipeeFn(i);
    var div = document.createElement('div');
    div.className = 'carte' + (equipee ? ' equipee' : '');
    div.style.borderLeftColor = hex(couleur);
    var pastille = document.createElement('span');
    pastille.className = 'pastille';
    pastille.style.background = hex(couleur);
    var infos = document.createElement('div');
    infos.className = 'infos';
    infos.innerHTML = '<strong></strong><small></small>';
    infos.querySelector('strong').textContent = def.nom;
    infos.querySelector('small').textContent = statTexte;
    var btn = document.createElement('button');
    btn.className = 'btn-acheter';
    btn.textContent = equipee ? 'Équipée' : possede ? 'Achetée' : def.cout + ' pièces';
    btn.disabled = possede || etat.pieces < def.cout;
    btn.addEventListener('click', function () { acheterFn(i); });
    div.appendChild(pastille);
    div.appendChild(infos);
    div.appendChild(btn);
    return div;
  }

  function rafraichirCartes() {
    var divP = document.getElementById('cartesPioches');
    var divB = document.getElementById('cartesBottes');
    divP.innerHTML = '';
    divB.innerHTML = '';
    L.PIOCHES.forEach(function (p, i) {
      divP.appendChild(creerCarte(
        L.PIOCHES, i, 'dégâts ' + p.degats + ' par coup', p.couleur,
        function (k) { return k <= etat.pioche; },
        function (k) { return k === etat.pioche; },
        function (k) {
          if (L.acheterPioche(k)) { majCouleurPioche(); ajouterJournal('Acheté : ' + p.nom); }
          else ajouterJournal('Pas assez de pièces pour ' + p.nom + '.');
          rafraichirHUD();
          L.sauvegarder();
        }
      ));
    });
    L.BOTTES.forEach(function (b0, i) {
      divB.appendChild(creerCarte(
        L.BOTTES, i, 'vitesse x' + b0.vitesse, COULEURS_BOTTES[i],
        function (k) { return k <= etat.bottes; },
        function (k) { return k === etat.bottes; },
        function (k) {
          if (L.acheterBottes(k)) ajouterJournal('Acheté : ' + b0.nom);
          else ajouterJournal('Pas assez de pièces pour ' + b0.nom + '.');
          rafraichirHUD();
          L.sauvegarder();
        }
      ));
    });
  }

  function basculerBoutique(ouvrir) {
    boutiqueOuverte = (typeof ouvrir === 'boolean') ? ouvrir : !boutiqueOuverte;
    if (boutiqueOuverte) basculerMarchand(false);
    menuBoutique.style.display = boutiqueOuverte ? 'flex' : 'none';
    if (boutiqueOuverte) {
      mining = false;
      if (document.pointerLockElement) document.exitPointerLock();
      rafraichirCartes();
    }
    mettreAJourOverlay();
  }

  // ---------- Marchand (revente des pépites) ----------
  var marchandOuvert = false;
  var presMarchand = false;
  var menuMarchand = document.getElementById('menuMarchand');
  var hintMarchand = document.getElementById('hintMarchand');

  function rafraichirCartesMarchand() {
    var div = document.getElementById('cartesPepites');
    div.innerHTML = '';
    L.INVENTAIRE_CLE.forEach(function (cleInv) {
      var n = etat.inventaire[cleInv] || 0;
      var prix = L.VALEURS_MARCHAND[cleInv];
      var carte = creerCarte(
        [{ nom: L.NOMS_PEPITES[cleInv], cout: prix }], 0,
        'x' + n + ' dans l’inventaire — ' + prix + ' pièces / unité',
        COULEURS_PEPITES[cleInv],
        function () { return n <= 0; },
        function () { return false; },
        function () {
          var total = L.vendreType(cleInv);
          if (total > 0) ajouterJournal('Vendu ' + n + ' ' + L.NOMS_PEPITES[cleInv].toLowerCase() + ' pour ' + total + ' pièces.');
          rafraichirHUD();
          L.sauvegarder();
        }
      );
      carte.querySelector('.btn-acheter').textContent = n > 0 ? 'Vendre tout (' + (n * prix) + ' pc)' : '—';
      div.appendChild(carte);
    });
    var btnTout = document.getElementById('vendreTout');
    var total = 0;
    L.INVENTAIRE_CLE.forEach(function (c) { total += (etat.inventaire[c] || 0) * L.VALEURS_MARCHAND[c]; });
    btnTout.textContent = total > 0 ? 'Tout vendre (' + total + ' pièces)' : 'Inventaire vide';
    btnTout.disabled = total <= 0;
  }

  function basculerMarchand(ouvrir) {
    marchandOuvert = (typeof ouvrir === 'boolean') ? ouvrir : !marchandOuvert;
    if (marchandOuvert) basculerBoutique(false);
    menuMarchand.style.display = marchandOuvert ? 'flex' : 'none';
    if (marchandOuvert) {
      mining = false;
      if (document.pointerLockElement) document.exitPointerLock();
      rafraichirCartesMarchand();
    }
    mettreAJourOverlay();
  }

  document.getElementById('vendreTout').addEventListener('click', function () {
    var total = L.vendreToutPepites();
    if (total > 0) ajouterJournal('Le marchand a tout racheté pour ' + total + ' pièces.');
    rafraichirHUD();
    L.sauvegarder();
  });

  document.getElementById('btnBoutique').addEventListener('click', function () { basculerBoutique(true); });
  document.getElementById('fermerBoutique').addEventListener('click', function () { basculerBoutique(false); });
  menuBoutique.addEventListener('mousedown', function (e) {
    if (e.target === menuBoutique) basculerBoutique(false);
  });
  document.getElementById('btnMarchand').addEventListener('click', function () { basculerMarchand(true); });
  document.getElementById('fermerMarchand').addEventListener('click', function () { basculerMarchand(false); });
  menuMarchand.addEventListener('mousedown', function (e) {
    if (e.target === menuMarchand) basculerMarchand(false);
  });

  // ---------- Minage ----------
  var swing = null;
  var mining = false;
  var raycaster = new THREE.Raycaster();
  var souris = new THREE.Vector2();
  var cible = null;

  function meshesVisibles() {
    var liste = [];
    for (var k in meshes) {
      if (meshes[k].visible && meshes[k].parent === scene) liste.push(meshes[k]);
    }
    return liste;
  }

  function blocViseDepuisCamera() {
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    var hits = raycaster.intersectObjects(meshesVisibles());
    if (!hits.length) return null;
    var oeil = new THREE.Vector3(joueur.position.x, joueur.position.y + OEIL, joueur.position.z);
    if (oeil.distanceTo(hits[0].point) > 4.5) return null;
    return hits[0].object;
  }

  function blocEnFace() {
    var p = joueur.position;
    var fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    var cx = Math.floor(p.x + fx * 1.1), cz = Math.floor(p.z + fz * 1.1);
    var py = Math.floor(p.y);
    var candidats = [
      [cx, py, cz], [cx, py + 1, cz], [cx, py - 1, cz],
      [Math.floor(p.x), py - 1, Math.floor(p.z)]
    ];
    for (var i = 0; i < candidats.length; i++) {
      if (L.blocEn(candidats[i][0], candidats[i][1], candidats[i][2])) return candidats[i];
    }
    return null;
  }

  function demarrerSwing(x, y, z) {
    if (swing || !L.blocEn(x, y, z)) return;
    swing = { x: x, y: y, z: z, t: 0, applique: false };
  }

  function appliquerFrappe(x, y, z) {
    var b = L.blocEn(x, y, z);
    var res = L.frapper(x, y, z);
    var m = meshes[L.cle(x, y, z)];
    if (res.casse) {
      if (m) {
        scene.remove(m);
        spawnFragments(m.position, L.BLOCS[b.type].couleur);
      }
      rafraichirVisibiliteAutour(x, y, z);
      if (res.pepite) {
        ajouterJournal('+1 ' + L.NOMS_PEPITES[res.pepite] + ' → inventaire (profondeur ' + (-y + 1) + ')');
      } else {
        ajouterJournal('+ ' + res.valeur + ' pièces (' + res.nom + ' cassé, profondeur ' + (-y + 1) + ')');
      }
      if (L.etendreSiNecessaire()) {
        creerNiveau(etat.niveauGenere);
        ajouterJournal('Nouvelle strate atteinte ! Niveau ' + (-etat.niveauGenere + 1) + ' généré.');
      }
    } else if (m) {
      m.userData.secousse = 0.25;
      assombrir(m);
    }
    rafraichirHUD();
    L.sauvegarder();
  }

  // ---------- Entrées ----------
  var touches = {};
  var yaw = 0, pitch = 0;
  var premierePersonne = true;
  var verrouActif = false;
  var overlay = document.getElementById('overlay');

  window.addEventListener('keydown', function (e) {
    L.enregistrerTouche(touches, e, true);
    if (e.code === 'Space') {
      e.preventDefault();
      if (auSol && !boutiqueOuverte && !marchandOuvert) vitesseY = IMPULSION_SAUT;
    }
    if (e.code === 'KeyB') basculerBoutique();
    if (e.code === 'KeyE') {
      if (presMarchand && !boutiqueOuverte) basculerMarchand();
      else if (marchandOuvert) basculerMarchand(false);
    }
    if (e.code === 'KeyT') basculerVue();
    if (e.code === 'Escape') {
      if (boutiqueOuverte) basculerBoutique(false);
      if (marchandOuvert) basculerMarchand(false);
    }
  });
  window.addEventListener('keyup', function (e) {
    L.enregistrerTouche(touches, e, false);
  });

  function basculerVue() {
    premierePersonne = !premierePersonne;
    joueur.visible = !premierePersonne;
    vuePioche.visible = premierePersonne;
    if (!premierePersonne && document.pointerLockElement) document.exitPointerLock();
    if (premierePersonne) yaw = joueur.rotation.y;
    mettreAJourOverlay();
    ajouterJournal(premierePersonne ? 'Vue première personne.' : 'Vue troisième personne.');
  }

  function mettreAJourOverlay() {
    overlay.style.display = (premierePersonne && !verrouActif && !boutiqueOuverte && !marchandOuvert) ? 'flex' : 'none';
  }

  canvas.addEventListener('mousedown', function (e) {
    if (boutiqueOuverte || marchandOuvert) return;
    if (premierePersonne) {
      if (!verrouActif) {
        try { canvas.requestPointerLock(); } catch (err) { /* souris non verrouillable : on joue au clic */ }
      }
      if (verrouActif) {
        mining = true;
        var m = blocViseDepuisCamera();
        if (m) demarrerSwing(m.userData.x, m.userData.y, m.userData.z);
      }
    }
    souris.x = (e.clientX / window.innerWidth) * 2 - 1;
    souris.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(souris, camera);
    var hits = raycaster.intersectObjects(meshesVisibles());
    if (hits.length) {
      var oeil = new THREE.Vector3(joueur.position.x, joueur.position.y + OEIL, joueur.position.z);
      if (oeil.distanceTo(hits[0].point) < 4.5) {
        var u = hits[0].object.userData;
        demarrerSwing(u.x, u.y, u.z);
      }
    }
  });

  document.addEventListener('mouseup', function () { mining = false; });

  document.addEventListener('mousemove', function (e) {
    if (verrouActif && premierePersonne) {
      yaw -= e.movementX * 0.0022;
      pitch -= e.movementY * 0.0022;
      pitch = Math.max(-1.5, Math.min(1.5, pitch));
    }
  });

  document.addEventListener('pointerlockchange', function () {
    verrouActif = document.pointerLockElement === canvas;
    mettreAJourOverlay();
  });

  overlay.addEventListener('click', function () {
    try { canvas.requestPointerLock(); } catch (err) { /* mode libre */ }
    setTimeout(function () { if (!verrouActif) overlay.style.display = 'none'; }, 400);
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- Boucle ----------
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  var horloge = new THREE.Clock();
  var phaseMarche = 0;

  function boucle() {
    requestAnimationFrame(boucle);
    var dt = Math.min(horloge.getDelta(), 0.033);
    var p = joueur.position;

    // Proximité du marchand
    presMarchand = Math.hypot(p.x - POS_MARCHAND.x, p.z - POS_MARCHAND.z) < 3.2;
    hintMarchand.style.display = (presMarchand && !boutiqueOuverte && !marchandOuvert) ? 'block' : 'none';

    // Déplacement (AZERTY + QWERTY + flèches)
    var axes = L.axesDepuisTouches(touches);
    var avant = axes.avant, droite = axes.droite;
    var enMouvement = (avant !== 0 || droite !== 0) && !boutiqueOuverte && !marchandOuvert;
    if (enMouvement) {
      var v = L.vecteurMouvement(yaw, avant, droite);
      var mx = v.mx, mz = v.mz;
      var vitesse = 5 * L.BOTTES[etat.bottes].vitesse;
      var nx = clamp(p.x + mx * vitesse * dt, HX, L.TX - HX);
      if (!chevauche(nx, p.y, p.z)) p.x = nx;
      var nz = clamp(p.z + mz * vitesse * dt, HZ, L.TZ - HZ);
      if (!chevauche(p.x, p.y, nz)) p.z = nz;
      joueur.rotation.y = L.yawModele(mx, mz); // cosmétique uniquement, yaw (souris) inchangé
    }

    // Gravité
    auSol = chevauche(p.x, p.y - 0.06, p.z);
    vitesseY = Math.max(vitesseY - GRAVITE * dt, -VITESSE_MAX_CHUTE);
    var ny = p.y + vitesseY * dt;
    if (chevauche(p.x, ny, p.z)) {
      if (vitesseY <= 0) { ny = Math.floor(ny) + 1; auSol = true; }
      else { ny = Math.floor(ny + HAUT) - HAUT - 0.001; }
      vitesseY = 0;
    }
    p.y = ny;

    // Animations
    if (enMouvement && auSol) phaseMarche += dt * 10;
    var a = enMouvement && auSol ? Math.sin(phaseMarche) * 0.55 : 0;
    jambeG.rotation.x = a;
    jambeD.rotation.x = -a;
    if (!swing) {
      brasG.rotation.x = -a * 0.5;
      brasD.rotation.x = a * 0.5;
    }
    vuePioche.position.y = -0.42 + (enMouvement && auSol ? Math.abs(Math.sin(phaseMarche)) * 0.04 : 0);

    // Minage continu (clic maintenu, souris verrouillée)
    if (premierePersonne && verrouActif && mining && !swing && !boutiqueOuverte && !marchandOuvert) {
      var m2 = blocViseDepuisCamera();
      if (m2) demarrerSwing(m2.userData.x, m2.userData.y, m2.userData.z);
      else {
        var c = blocEnFace();
        if (c) demarrerSwing(c[0], c[1], c[2]);
      }
    }

    // Surbrillance de la cible
    var nouvelleCible = (premierePersonne && !boutiqueOuverte && !marchandOuvert) ? blocViseDepuisCamera() : null;
    if (nouvelleCible !== cible) {
      if (cible) surligner(cible, false);
      cible = nouvelleCible;
      if (cible) surligner(cible, true);
    }

    // Animation du coup de pioche
    if (swing) {
      swing.t += dt / 0.3;
      var s = Math.sin(Math.min(swing.t, 1) * Math.PI);
      var arme = premierePersonne ? vuePioche : brasD;
      arme.rotation.x = -2.4 * s;
      if (!swing.applique && swing.t >= 0.5) {
        swing.applique = true;
        appliquerFrappe(swing.x, swing.y, swing.z);
      }
      if (swing.t >= 1) {
        swing = null;
        arme.rotation.x = 0;
      }
    }

    // Secousses
    for (var k in meshes) {
      var mm = meshes[k];
      if (mm.userData.secousse > 0) {
        mm.userData.secousse -= dt;
        mm.position.x = mm.userData.x + 0.5 + (Math.random() - 0.5) * 0.12;
        if (mm.userData.secousse <= 0) mm.position.x = mm.userData.x + 0.5;
      }
    }

    // Fragments
    for (var i = fragments.length - 1; i >= 0; i--) {
      var f = fragments[i];
      f.userData.duree -= dt;
      f.userData.vitesse.y -= 20 * dt;
      f.position.addScaledVector(f.userData.vitesse, dt);
      if (f.position.y < 0.06) { f.position.y = 0.06; f.userData.vitesse.set(0, 0, 0); }
      if (f.userData.duree <= 0) {
        scene.remove(f);
        fragments.splice(i, 1);
      }
    }

    // Nuages
    nuages.forEach(function (n) {
      n.position.x += dt * 0.5;
      if (n.position.x > 70) n.position.x = -70;
    });

    // Caméra
    if (premierePersonne) {
      camera.position.set(p.x, p.y + OEIL, p.z);
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    } else {
      camera.position.lerp(new THREE.Vector3(p.x, p.y + 6.5, p.z + 9.5), 0.08);
      camera.lookAt(p.x, p.y + 1.2, p.z);
    }

    renderer.render(scene, camera);
  }

  // ---------- Démarrage ----------
  L.charger();
  creerTousLesMeshes();
  rafraichirHUD();
  joueur.visible = false;
  vuePioche.visible = true;
  mettreAJourOverlay();
  ajouterJournal('Clique pour verrouiller la souris. B = boutique, E près du marchand pour vendre tes pépites.');
  boucle();
})();
