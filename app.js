/**
 * ============================================================
 *  MONITOREO HÍDRICO — App Admin
 *  Envío de datos al backend de Google Apps Script
 * ============================================================
 *  ⚠️ REEMPLAZA esta URL con la de tu implementación /exec
 * ============================================================
 */
const API_URL = 'https://script.google.com/macros/s/TU_DEPLOYMENT_ID/exec';

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
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}` +
         `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Pre-cargar la fecha/hora actual
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
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function setLoading(button, loading, textOriginal = '💾 Guardar Datos') {
  button.disabled = loading;
  button.textContent = loading ? '⏳ Enviando...' : textOriginal;
}

/* ------------------------------------------------------------
   ENVÍO AL BACKEND
------------------------------------------------------------ */
async function enviarDatos(tipo, data) {
  const response = await fetch(API_URL, {
    method: 'POST',
    mode: 'cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
    body: JSON.stringify({ tipo, data })
  });

  if (!response.ok) throw new Error('Error de red al contactar al servidor.');
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'Error desconocido del servidor.');
  return result;
}

/* ------------------------------------------------------------
   FORM: LLUVIAS
------------------------------------------------------------ */
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
    Fecha:        formData.get('Fecha'),
    Estacion:     formData.get('Estacion'),
    Cuenca:       formData.get('Cuenca'),
    Milimetros:   parseFloat(formData.get('Milimetros'))
  };

  try {
    const res = await enviarDatos('lluvias', data);
    showToast(res.message || 'Datos guardados en Google Sheets');
    formLluvias.reset();
    document.getElementById('ll_fecha').value = toLocalISO(new Date());
  } catch (err) {
    showToast(err.message, true);
  } finally {
    setLoading(btn, false);
  }
});

/* ------------------------------------------------------------
   FORM: PRESAS
------------------------------------------------------------ */
const formPresas = document.getElementById('formPresas');

formPresas.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!formPresas.checkValidity()) {
    formPresas.reportValidity();
    showToast('Completa todos los campos correctamente.', true);
    return;
  }

  const pct = parseFloat(document.getElementById('pr_pct').value);
  if (pct < 0 || pct > 100) {
    showToast('El porcentaje útil debe estar entre 0 y 100.', true);
    return;
  }

  const btn = formPresas.querySelector('button[type="submit"]');
  setLoading(btn, true);

  const formData = new FormData(formPresas);
  const data = {
    Fecha:             formData.get('Fecha'),
    Nombre_Presa:      formData.get('Nombre_Presa'),
    Nivel_Operacion:   parseFloat(formData.get('Nivel_Operacion')),
    Porcentaje_Util:   pct
  };

  try {
    const res = await enviarDatos('presas', data);
    showToast(res.message || 'Datos guardados en Google Sheets');
    formPresas.reset();
    document.getElementById('pr_fecha').value = toLocalISO(new Date());
  } catch (err) {
    showToast(err.message, true);
  } finally {
    setLoading(btn, false);
  }
});
