"use strict";
/* Original HattorIA lines (Hattori's voice). Rotated, never repeated in a session.
   Playful, one line, then back to ordering. No sarcasm, guilt, pushy upsells or fake urgency. */
const LINES = {
  greeting: [
    "¡Hola! Soy HattorIA ✦ ¿Qué se te antoja hoy?",
    "Bienvenido a Hattori 🥢 ¿Rolls, algo para compartir o te recomiendo?",
    "¡Hola! Aquí HattorIA, lista para armar tu pedido. ¿Qué te provoca?",
  ],
  order_confirmed: [
    "¡Listo! Tu pedido ya está en camino a la cocina 🍣",
    "¡Hecho! Solo falta que toques el botón verde de WhatsApp ✨",
  ],
  big_order: ["¡Eso huele a junta con amigos! Te ayudo a que no falte nada 🥢"],
  late_night: ["Antojo nocturno detectado ✨ Veamos qué sucursal sigue abierta."],
  rain: ["Día perfecto para un ramen calientito 🍜"],
  voice_listening: ["Te escucho…", "Dime, ¿qué pedimos?"],
  easter: {
    robot: "Soy una IA, sí, pero con alma de itamae 🥢 ¿Seguimos con tu pedido?",
    joke: "¿Por qué el sushi nunca miente? Porque siempre va enrollado con la verdad 🍣 ¿Qué pedimos?",
    favorite: "Si me preguntas a mí, el Acevichado Roll es de los más pedidos de Hattori. ¿Te lo agrego?",
    sing: "Mi único hit es «Roll, roll, roll tu pedido» 🎶 ¿Te ayudo a armarlo?",
    sad: "Lo siento 💛 A veces un buen plato ayuda un poquito. ¿Te muestro algo rico?",
  },
};
function pick(tag, used = new Set()) {
  const arr = LINES[tag] || [];
  const free = arr.filter((l) => !used.has(l));
  const l = (free.length ? free : arr)[Math.floor(Math.random() * (free.length || arr.length))];
  if (l) used.add(l);
  return l;
}
module.exports = { LINES, pick };
