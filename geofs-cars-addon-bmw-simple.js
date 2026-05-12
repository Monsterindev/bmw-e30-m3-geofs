// ================================================================
//  🚗 GeoFS — BMW E30 M3 ADDON v1.0
//  Colle ce code dans la console F12 sur geo-fs.com
// ================================================================

(function () {
  'use strict';
  console.error('[BMW E30] 🚗 Addon BMW E30 M3 démarré...');

  // ═══════════════════════════════════════════════════════════
  //  BMW E30 M3 SPORT EVOLUTION 1990
  // ═══════════════════════════════════════════════════════════
  var BMW_E30 = {
    id: 'bmw_e30_m3',
    name: 'BMW E30 M3 Sport Evolution',
    year: '1990',
    emoji: '🔵',
    color: '#1a4fa0',
    modelUrl: 'https://raw.githubusercontent.com/Monsterindev/bmw-e30-m3-geofs/main/models/BMW_E30_M3_PRET_FINAL_MODEL_90.glb',
    geofsId: 102,  // Base: Citroën 2CV (seule vraie voiture de GeoFS)
    physics: {
      thrust:    0.8,        // Moteur 4 cyl 2.3L ~195ch
      drag:      0.18,       // Cx 0.33
      maxSpeed:  240,        // 238 km/h
      weight:    1200,
      traction: 'rwd',
    },
    description: 'La légende Groupe A. 4 cyl. 2.3L, 195ch, 1200kg.',
    badge: 'GROUP A'
  };

  // ═══════════════════════════════════════════════════════════
  //  ÉTAT
  // ═══════════════════════════════════════════════════════════
  var activeCar  = null;
  var basePhysics = null;
  var modInterval = null;

  // ═══════════════════════════════════════════════════════════
  //  CHARGEMENT VOITURE
  // ═══════════════════════════════════════════════════════════
  function loadCar(car) {
    var inst = geofs && geofs.aircraft && geofs.aircraft.instance;
    if (!inst) { 
      showToast('❌ GeoFS non prêt'); 
      return; 
    }

    // Charger la base GeoFS (Citroën 2CV)
    var currentId = inst.aircraftRecord && inst.aircraftRecord.id;
    if (String(currentId) !== String(car.geofsId)) {
      setStatus('⏳ Chargement de la base...', false);
      geofs.loadAircraft(car.geofsId);
      
      // Attendre que l'avion soit chargé
      var w = setInterval(function () {
        var i2 = geofs.aircraft.instance;
        if (i2 && i2.aircraftRecord && String(i2.aircraftRecord.id) === String(car.geofsId) &&
            i2.parts && Object.keys(i2.parts).length > 0) {
          clearInterval(w);
          setTimeout(function () { 
            applyCarPhysics(car); 
          }, 800);
        }
      }, 300);
    } else {
      applyCarPhysics(car);
    }
  }

  function applyCarPhysics(car) {
    var inst = geofs.aircraft.instance;
    var def  = inst.definition;
    if (!def) { 
      setStatus('❌ Définition manquante', true); 
      return; 
    }

    // Sauvegarde physique originale une seule fois
    if (!basePhysics) {
      basePhysics = {
        zta    : def.zeroThrustAltitude,
        zra    : def.zeroRPMAltitude,
        thrust : {},
        drag   : (def.airfoils||[]).map(function(af){ return {drag:af.drag,lift:af.lift}; }),
        fdrag  : def.fuselage ? def.fuselage.drag : null
      };
      for (var n in inst.parts) {
        var p = inst.parts[n];
        if (p && p.thrust != null) basePhysics.thrust[n] = p.thrust;
      }
    }

    var ph = car.physics;

    // 1. Plafond moteur (voiture = pas d'altitude limite)
    def.zeroThrustAltitude = 5000;
    def.zeroRPMAltitude    = 5000;

    // 2. Poussée selon le modèle
    for (var nm in inst.parts) {
      var pp = inst.parts[nm];
      var orig = basePhysics.thrust[nm];
      if (!pp || pp.thrust == null || orig == null) continue;
      pp.thrust = orig * ph.thrust;
    }

    // 3. Traînée selon le Cx
    if (def.airfoils) {
      def.airfoils.forEach(function(af) {
        if (af.drag != null) af.drag = ph.drag;
        if (af.lift != null) af.lift = af.lift * 0.3;
      });
    }
    if (def.fuselage && def.fuselage.drag != null) def.fuselage.drag = ph.drag;

    // Stocker voiture active
    activeCar = car;

    // Démarrer surveillance
    if (modInterval) clearInterval(modInterval);
    modInterval = setInterval(function () {
      if (activeCar) applyCarPhysics(activeCar);
    }, 2000);

    setStatus('✅ ' + car.name + ' (' + car.year + ')', false);
    updateActiveBtn(car.id);
    showToast('🚗 ' + car.name + ' chargée !');
    console.error('[BMW E30] Voiture activée : ' + car.name + ' | thrust×' + ph.thrust + ' | drag=' + ph.drag);
  }

  function resetPhysics() {
    var inst = geofs.aircraft.instance;
    var def  = inst && inst.definition;
    if (!def || !basePhysics) return;
    if (basePhysics.zta != null) def.zeroThrustAltitude = basePhysics.zta;
    if (basePhysics.zra != null) def.zeroRPMAltitude    = basePhysics.zra;
    for (var n in basePhysics.thrust) {
      if (inst.parts[n]) inst.parts[n].thrust = basePhysics.thrust[n];
    }
    if (def.airfoils)
      def.airfoils.forEach(function(af,i){ var s=basePhysics.drag[i]; if(s){af.drag=s.drag;af.lift=s.lift;} });
    if (def.fuselage && basePhysics.fdrag != null) def.fuselage.drag = basePhysics.fdrag;
    if (modInterval) { clearInterval(modInterval); modInterval = null; }
    activeCar  = null;
    basePhysics = null;
    setStatus('Aucune voiture active', false);
    updateActiveBtn(null);
    showToast('↺ Physique réinitialisée');
  }

  // ═══════════════════════════════════════════════════════════
  //  UI
  // ═══════════════════════════════════════════════════════════
  function buildUI() {
    var old = document.getElementById('_bmw_panel');
    if (old) old.remove();

    var s = document.createElement('style');
    s.id  = '_bmw_style';
    s.textContent = `
      #_bmw_panel {
        position: fixed; bottom: 50px; left: 10px;
        z-index: 2147483647; font-family: 'Segoe UI', monospace;
        background: rgba(5,5,10,0.96);
        border: 1.5px solid #e05500;
        border-radius: 10px; overflow: hidden;
        min-width: 280px; max-width: 300px;
        box-shadow: 0 0 24px rgba(220,85,0,0.2);
      }
      #_bmw_head {
        padding: 12px 14px;
        background: rgba(100,30,0,0.6);
        color: #ff8c42;
        font-weight: bold; letter-spacing: 1px; font-size: 13px;
        cursor: pointer;
        display: flex; align-items: center; gap: 8px;
        border-bottom: 1px solid #e05500;
      }
      #_bmw_head:hover { background: rgba(140,45,0,0.7); }
      #_bmw_body { padding: 12px 14px; }
      #_bmw_status {
        font-size: 11px; padding: 8px 11px; border-radius: 5px;
        margin-bottom: 12px; font-family: monospace;
        background: rgba(220,85,0,0.08);
        border: 1px solid #5a2500; color: #ff8c42;
        transition: all .3s;
      }
      #_bmw_status.ok { color: #00ff88; border-color: #006633; background: rgba(0,255,136,0.07); }
      #_bmw_status.err { color: #ff4444; border-color: #660000; background: rgba(255,68,68,0.07); }
      ._bmw_card {
        width: 100%; padding: 12px 12px;
        border-radius: 6px; border: 1px solid #2a1500;
        background: rgba(220,85,0,0.08);
        cursor: pointer; text-align: left;
        display: flex; gap: 10px; align-items: center;
        transition: all .15s;
      }
      ._bmw_card:hover { background: rgba(220,85,0,0.2); border-color: #e05500; }
      ._bmw_card.active {
        background: rgba(220,85,0,0.3); border-color: #ff8c42;
        box-shadow: 0 0 10px rgba(220,85,0,0.3);
      }
      ._bmw_emoji { font-size: 28px; }
      ._bmw_info {}
      ._bmw_name { display: block; color: #ff8c42; font-size: 13px; font-weight: bold; }
      ._bmw_desc { display: block; color: #5a3520; font-size: 10px; margin-top: 2px; }
      ._bmw_badge {
        font-size: 9px; padding: 3px 7px; border-radius: 3px;
        background: rgba(220,85,0,0.25); color: #ff8c42;
        border: 1px solid #5a2500; font-weight: bold;
      }
      #_bmw_reset {
        width: 100%; padding: 10px; margin-top: 8px; border-radius: 5px;
        border: 1px solid #3a1a00; background: transparent;
        color: #5a3520; font-size: 11px; cursor: pointer; transition: all .15s;
        font-family: monospace; font-weight: bold;
      }
      #_bmw_reset:hover { background: rgba(255,68,68,0.12); border-color: #ff4444; color: #ff4444; }
      #_bmw_hint {
        text-align: center; font-size: 10px; color: #3a1a00;
        margin-top: 10px; padding-top: 8px;
        border-top: 1px solid #1a0a00; font-family: monospace;
      }
      #_bmw_toast {
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: rgba(5,5,10,0.96); border: 1px solid #e05500;
        color: #ff8c42; font-family: monospace; font-size: 12px;
        padding: 10px 24px; border-radius: 6px; z-index: 2147483648;
        pointer-events: none; opacity: 0; transition: opacity .3s;
        box-shadow: 0 0 14px rgba(220,85,0,0.2); white-space: nowrap;
      }
    `;
    document.head.appendChild(s);

    // Panel
    var el = document.createElement('div');
    el.id  = '_bmw_panel';
    el.innerHTML =
      '<div id="_bmw_head">🚗 BMW E30 M3</div>' +
      '<div id="_bmw_body">' +
        '<div id="_bmw_status">Aucune voiture active</div>' +
        '<div class="_bmw_card" id="_card_bmw_e30" onclick="window._bmwLoad()">'+
          '<span class="_bmw_emoji">🔵</span>'+
          '<span class="_bmw_info">'+
            '<span class="_bmw_name">BMW E30 M3 Sport Evo</span>'+
            '<span class="_bmw_desc">Groupe A • 195ch • 1990</span>'+
          '</span>'+
          '<span class="_bmw_badge">GROUP A</span>'+
        '</div>' +
        '<button id="_bmw_reset" onclick="window._bmwReset()">↺ Réinitialiser</button>' +
        '<div id="_bmw_hint">v1.0 • geo-fs.com</div>' +
      '</div>';
    document.body.appendChild(el);

    // Toggle collapse
    document.getElementById('_bmw_head').onclick = function() {
      var b = document.getElementById('_bmw_body');
      b.style.display = b.style.display === 'none' ? 'block' : 'none';
    };

    // Toast
    var t = document.createElement('div');
    t.id = '_bmw_toast';
    document.body.appendChild(t);
  }

  // Exposer fonctions au DOM
  var toastT;
  window._bmwLoad = function() {
    loadCar(BMW_E30);
  };
  window._bmwReset = resetPhysics;

  function setStatus(msg, isErr) {
    var el = document.getElementById('_bmw_status');
    if (!el) return;
    el.textContent = msg;
    el.className = isErr ? 'err' : (activeCar ? 'ok' : '');
  }

  function updateActiveBtn(activeId) {
    var btn = document.getElementById('_card_bmw_e30');
    if (btn) btn.classList.toggle('active', activeId === 'bmw_e30_m3');
  }

  function showToast(msg) {
    var t = document.getElementById('_bmw_toast');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(toastT);
    toastT = setTimeout(function(){ t.style.opacity = '0'; }, 2500);
  }

  // ═══════════════════════════════════════════════════════════
  //  ATTENTE GeoFS
  // ═══════════════════════════════════════════════════════════
  var attempts = 0;
  function checkReady() {
    attempts++;
    var ok = (
      typeof geofs !== 'undefined' &&
      geofs.aircraft &&
      geofs.aircraft.instance &&
      geofs.aircraft.instance.parts &&
      geofs.aircraft.instance.definition
    );
    if (ok) {
      buildUI();
      console.error('[BMW E30] ✅ Prêt ! Panneau 🚗 en bas à gauche.');
    } else if (attempts < 90) {
      setTimeout(checkReady, 1000);
    } else {
      console.error('[BMW E30] ❌ Timeout. Recharge la page.');
    }
  }

  setTimeout(checkReady, 3000);

})();
