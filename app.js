/* ============================================================
   PANEL ADMIN · MONITOREO HÍDRICO INDRHI
   ============================================================
   ⚠️ IMPORTANTE — LEE ESTO ANTES DE DESPLEGAR:
   
   Google Apps Script te da DOS URLs diferentes:
   
   1) URL de LECTURA (GET):
      https://script.googleusercontent.com/macros/echo?user_content_key=...
      → Solo sirve para LEER. NO acepta POST.
   
   2) URL de ESCRITURA (POST):
      https://script.google.com/macros/s/XXXXXXXXXXXX/exec
      → Es la que se usa para GUARDAR datos.
   
   Para que el panel admin funcione, DEBES colocar la URL /exec
   en GOOGLE_SCRIPT_URL. Si solo tienes la URL /echo, entonces
   tu Web App está publicada como solo-lectura y necesitas
   re-publicarla (Implementar → Aplicación web).
   
   Si accidentalmente dejas la URL /echo, el navegador mostrará:
     "Failed to fetch" (porque Google rechaza el POST)
   ============================================================ */

// ⬇️ REEMPLAZA ESTA URL con la de tu implementación /exec
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec';

// Alternativa de solo lectura (por si quieres consultar datos desde aquí)
const GOOGLE_SCRIPT_READ_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=AUkAhnQ-zUzUz8ahCSNVoH8cTbEWjhQjKA-ECr7Q6ENxpaGNP4_Zbnv0bIAuFqNmXLK3C7x07lEwLKWDICmADn2sFmim6l2yw72xP-J5nZ_XKGY9sqnBulJhf6jqpjiMZ8iZYU8wc5u6cxLbdh8GZSdIsWSBdW8mRiJuNMTW2_ptLwzPFBa-BiivRXbRVUNZy2byuk7id6Gi-f4QIcwIi9c2T3DfCPiO0qq3crMucMUXuJ_8N4GVrNU60q1pabxQL3F6MO95TdSmr6HCfIoAEEsxNinlQsg1Gw&lib=MqzpnpKQXI6-7R1puCMPz8jkmKwee5e9k';

/* ------------------------------------------------------------
   TABS
------------------------------------------------------------ */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${target}`).classList.add('active');
  });
});

/* ------------------------------------------------------------
   UTILIDADES
------------------------------------------------------------ */
function toLocalISO(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
         `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const now = toLocalISO(new Date());
  document.getElementById('ll_fecha').value = now;
  document.getElementById('pr_fecha').value = now;
});

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = (isError ? '❌ ' : '✅ ') + message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 4000);
}

function setLoading(button, loading, textOriginal = '💾 Guardar Datos') {
  button.disabled = loading;
  button.textContent = loading ? '⏳ Enviando...' : textOriginal;
}

/* ------------------------------------------------------------
   FETCH ROBUSTO HACIA APPS SCRIPT
   
   Detalles clave para que NO falle:
   - method: 'POST'
   - mode: 'cors' (Apps Script moderno lo soporta)
   - headers: Content-Type text/plain (evita preflight OPTIONS)
   - redirect: 'follow' (Apps Script redirige a googleusercontent.com)
   - body: JSON.stringify(...)
------------------------------------------------------------ */
async function enviarDatosAlServidor(payload) {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      cache: 'no-store',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status} — ${response.statusText}`);
    }

    const texto = await response.text();

    // Apps Script puede devolver JSON o HTML (si hay error de permisos)
    let json;
    try {
      json = JSON.parse(texto);
    } catch (e) {
      console.error('Respuesta no-JSON:', texto.substring(0, 300));
      throw new Error(
        'Respuesta inválida del servidor. Verifica que la URL termine en /exec ' +
        'y que el Web App esté publicado con acceso "Cualquier persona".'
      );
    }

    if (!json.ok) {
      throw new Error(json.error || 'El servidor rechazó los datos.');
    }

    return json;
  } catch (err) {
    // Enriquecer el mensaje para el operador
    if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
      throw new Error(
        'No se pudo conectar con Google Sheets. Verifica tu conexión a internet ' +
        'y que la URL del Web App sea la correcta (debe terminar en /exec).'
      );
    }
    throw err;
  }
}

/* ============================================================
   FORMULARIO: LLUVIAS
   Payload: { tipo: "lluvias", data: { Fecha, Estacion, Milimetros } }
   ============================================================ */
const formLluvias = document.getElementById('formLluvias');

formLluvias.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!formLluvias.checkValidity()) {
    formLluvias.reportValidity();
    showToast('Completa todos los campos correctamente.', true);
    return;
  }

  const btn = formLluvias.querySelector('button[type="submit"]');
  setLoading(btn, true);

  const formData = new FormData(formLluvias);
  const data = {
    Fecha:      formData.get('Fecha'),
    Estacion:   formData.get('Estacion'),
    Milimetros: parseFloat(formData.get('Milimetros'))
  };

  if (isNaN(data.Milimetros) || data.Milimetros < 0) {
    showToast('Ingresa un valor válido de lluvia en mm.', true);
    setLoading(btn, false);
    return;
  }

  try {
    const res = await enviarDatosAlServidor({ tipo: 'lluvias', data });
    showToast(res.message || 'Datos guardados en Google Sheets');
    formLluvias.reset();
    document.getElementById('ll_fecha').value = toLocalISO(new Date());
  } catch (err) {
    console.error(err);
    showToast(err.message, true);
  } finally {
    setLoading(btn, false);
  }
});

/* ============================================================
   FORMULARIO: PRESAS
   Payload: { tipo: "presas", data: { Fecha, Nombre_Presa, Nivel_Operacion, Porcentaje_Util } }
   ============================================================ */
const formPresas = document.getElementById('formPresas');

formPresas.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!formPresas.checkValidity()) {
    formPresas.reportValidity();
    showToast('Completa todos los campos correctamente.', true);
    return;
  }

  const pct = parseFloat(document.getElementById('pr_pct').value);
  if (isNaN(pct) || pct < 0 || pct > 100) {
    showToast('El porcentaje útil debe estar entre 0 y 100.', true);
    return;
  }

  const btn = formPresas.querySelector('button[type="submit"]');
  setLoading(btn, true);

  const formData = new FormData(formPresas);
  const data = {
    Fecha:           formData.get('Fecha'),
    Nombre_Presa:    formData.get('Nombre_Presa'),
    Nivel_Operacion: parseFloat(formData.get('Nivel_Operacion')),
    Porcentaje_Util: pct
  };

  try {
    const res = await enviarDatosAlServidor({ tipo: 'presas', data });
    showToast(res.message || 'Datos guardados en Google Sheets');
    formPresas.reset();
    document.getElementById('pr_fecha').value = toLocalISO(new Date());
  } catch (err) {
    console.error(err);
    showToast(err.message, true);
  } finally {
    setLoading(btn, false);
  }
});
