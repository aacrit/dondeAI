/* ============================================
   DondeAI — Utilities
   SVG icon system, cuisine mapping, scores, helpers
   ============================================ */

/* ---- SVG Icon Registry (Phosphor-compatible 256x256 viewBox) ---- */
export const ICON_SVG = {
  // Cuisine icons
  sushi:         '<path fill="currentColor" d="M224,104a16,16,0,0,0-16-16H48a16,16,0,0,0-16,16v8a40,40,0,0,0,40,40h112a40,40,0,0,0,40-40Zm-8,8a32,32,0,0,1-32,32H72a32,32,0,0,1-32-32v-8a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8ZM200,160H56a8,8,0,0,0,0,16H200a8,8,0,0,0,0-16Z"/>',
  taco:          '<path fill="currentColor" d="M229.06,124.07c-1.08-27.67-12.25-53.63-31.44-73.14A111.22,111.22,0,0,0,128,16,111.22,111.22,0,0,0,58.38,50.93C39.19,70.44,28,96.4,26.94,124.07A40,40,0,0,0,56,168H200a40,40,0,0,0,29.06-43.93ZM128,32a95.34,95.34,0,0,1,59.46,30H68.54A95.34,95.34,0,0,1,128,32ZM200,152H56a24,24,0,0,1,0-48l.35,0A95.06,95.06,0,0,0,128,136a95.06,95.06,0,0,0,71.65-31.95l.35,0a24,24,0,0,1,0,48Z"/>',
  pasta:         '<path fill="currentColor" d="M224,80a8,8,0,0,1-8,8H196.26a57.42,57.42,0,0,1-4.18,17.54c6.85,8.34,12,19.33,12,34.46a72,72,0,0,1-144,0c0-15.13,5.17-26.12,12-34.46A57.42,57.42,0,0,1,67.74,88H40a8,8,0,0,1,0-16h80V48H88a8,8,0,0,1,0-16h80a8,8,0,0,1,0,16H136V72h80A8,8,0,0,1,224,80Zm-96,128a56.06,56.06,0,0,0,56-56c0-24-16-40-32-48H104c-16,8-32,24-32,48A56.06,56.06,0,0,0,128,208Z"/>',
  curry:         '<path fill="currentColor" d="M224,112H207.37a80.11,80.11,0,0,0-158.74,0H32a8,8,0,0,0,0,16H48.81A96.19,96.19,0,0,0,80,183.55V192a32,32,0,0,0,32,32h32a32,32,0,0,0,32-32v-8.45A96.19,96.19,0,0,0,207.19,128H224a8,8,0,0,0,0-16Zm-96-64a64.07,64.07,0,0,1,63.48,56H64.52A64.07,64.07,0,0,1,128,48Z"/>',
  noodles:       '<path fill="currentColor" d="M224,112H207.37a80.11,80.11,0,0,0-158.74,0H32a8,8,0,0,0,0,16H48.81A96.19,96.19,0,0,0,80,183.55V192a32,32,0,0,0,32,32h32a32,32,0,0,0,32-32v-8.45A96.19,96.19,0,0,0,207.19,128H224a8,8,0,0,0,0-16ZM80,72V48a8,8,0,0,1,16,0v64a8,8,0,0,1-16,0Zm32,0V48a8,8,0,0,1,16,0v64a8,8,0,0,1-16,0Zm32,0V48a8,8,0,0,1,16,0v64a8,8,0,0,1-16,0Z"/>',
  dumpling:      '<path fill="currentColor" d="M128,24C70.65,24,24,60.86,24,106c0,25.84,14.6,49.13,40,64.71V200a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V170.71c25.4-15.58,40-38.87,40-64.71C232,60.86,185.35,24,128,24Zm48,176H80V176h96Zm-1.51-40H81.51C56.29,145.44,40,126.58,40,106c0-36.94,39.53-66,88-66s88,29.06,88,66C216,126.58,199.71,145.44,174.49,160Z"/>',
  meat:          '<path fill="currentColor" d="M212,88a27.86,27.86,0,0,0-19.81,8.19l-6.43-6.43a44,44,0,0,0-19.81-47.85A28,28,0,0,0,124.2,28.2a28,28,0,0,0-13.71,41.74A44,44,0,0,0,62.64,89.75l-6.43,6.43A28,28,0,1,0,44,136a27.86,27.86,0,0,0,19.81-8.19L176.19,15.43A28,28,0,0,0,212,88ZM68,184a8,8,0,1,1-8-8A8,8,0,0,1,68,184Zm28-24a8,8,0,1,1-8-8A8,8,0,0,1,96,160Zm32,16a8,8,0,1,1-8-8A8,8,0,0,1,128,176Z"/>',
  croissant:     '<path fill="currentColor" d="M200,80H136V56h24a8,8,0,0,0,7.35-4.82l16-37.33A8,8,0,0,0,176,3.52L148.05,56H107.95L80,3.52a8,8,0,0,0-7.35-4.82,8,8,0,0,0-7.35,11.48l16,37.33A8,8,0,0,0,88.66,52H120V80H56A56,56,0,0,0,56,192h144a56,56,0,0,0,0-112Z"/>',
  seafood:       '<path fill="currentColor" d="M168,76a12,12,0,1,1-12-12A12,12,0,0,1,168,76Zm-8,52a8,8,0,0,0-8,8,24,24,0,0,1-48,0V80.47c27.2-4.77,48-28.6,48-57.47a8,8,0,0,0-13.17-6.13L110.93,40.6,82.29,17A8,8,0,0,0,68.54,18l-6.7,21.39L30.29,17A8,8,0,0,0,16,24V136a80,80,0,0,0,160,0A8,8,0,0,0,160,128Z"/>',
  burger:        '<path fill="currentColor" d="M48,104H208a8,8,0,0,0,0-16c0-40-33.6-72-80-72S48,48,48,88a8,8,0,0,0,0,16Zm80-72c35.64,0,62.27,22.52,63.92,56H64.08C65.73,54.52,92.36,32,128,32ZM232,168a8,8,0,0,1-8,8H32a8,8,0,0,1,0-16H224A8,8,0,0,1,232,168Zm-16,24H40a8,8,0,0,0,0,16H216a8,8,0,0,0,0-16ZM28,144H228a8,8,0,0,0,3.35-15.25c-.08,0-6.28-2.75-6.28-2.75H30.93s-6.2,2.71-6.28,2.75A8,8,0,0,0,28,144Z"/>',
  coffee:        '<path fill="currentColor" d="M80,56V24a8,8,0,0,1,16,0V56a8,8,0,0,1-16,0Zm40,8a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,120,64Zm32,0a8,8,0,0,0,8-8V24a8,8,0,0,0-16,0V56A8,8,0,0,0,152,64Zm96,56a40,40,0,0,1-40,40H196.65A72.08,72.08,0,0,1,136,215.54V232h24a8,8,0,0,1,0,16H96a8,8,0,0,1,0-16h24V215.54A72.08,72.08,0,0,1,48,144V88a8,8,0,0,1,8-8H200a8,8,0,0,1,8,8v8h0A40,40,0,0,1,248,120Zm-16,0a24,24,0,0,0-16-22.62V144a72.3,72.3,0,0,1-2.54,19.21A24,24,0,0,0,232,120Z"/>',
  cocktail:      '<path fill="currentColor" d="M237.66,45.66A8,8,0,0,0,232,32H24a8,8,0,0,0-5.66,13.66L120,147.31V216H88a8,8,0,0,0,0,16h80a8,8,0,0,0,0-16H136V147.31ZM59.31,48H196.69l-16,16H75.31Z"/>',
  salad:         '<path fill="currentColor" d="M224,112H207.37a80.11,80.11,0,0,0-158.74,0H32a8,8,0,0,0,0,16H48.81A96.19,96.19,0,0,0,80,183.55V192a32,32,0,0,0,32,32h32a32,32,0,0,0,32-32v-8.45A96.19,96.19,0,0,0,207.19,128H224a8,8,0,0,0,0-16ZM128,48a64.07,64.07,0,0,1,63.48,56H64.52A64.07,64.07,0,0,1,128,48Z"/>',
  brunch:        '<path fill="currentColor" d="M200,48H136V32h8a8,8,0,0,0,0-16H112a8,8,0,0,0,0,16h8V48H56A32,32,0,0,0,24,80v8a72.08,72.08,0,0,0,56,70.21V176H56a8,8,0,0,0,0,16H200a8,8,0,0,0,0-16H176V158.21A72.08,72.08,0,0,0,232,88V80A32,32,0,0,0,200,48Zm16,40a56.06,56.06,0,0,1-56,56H96a56.06,56.06,0,0,1-56-56V80A16,16,0,0,1,56,64H200a16,16,0,0,1,16,16Z"/>',
  mediterranean: '<path fill="currentColor" d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm48-88a48,48,0,1,1-48-48A48.05,48.05,0,0,1,176,128Z"/>',
  stew:          '<path fill="currentColor" d="M224,112H207.37a80.11,80.11,0,0,0-158.74,0H32a8,8,0,0,0,0,16H48.81A96.19,96.19,0,0,0,80,183.55V192a32,32,0,0,0,32,32h32a32,32,0,0,0,32-32v-8.45A96.19,96.19,0,0,0,207.19,128H224a8,8,0,0,0,0-16Z"/>',
  ceviche:       '<path fill="currentColor" d="M168,76a12,12,0,1,1-12-12A12,12,0,0,1,168,76Zm-8,52a8,8,0,0,0-8,8,24,24,0,0,1-48,0V80.47c27.2-4.77,48-28.6,48-57.47a8,8,0,0,0-13.17-6.13L110.93,40.6,82.29,17A8,8,0,0,0,68.54,18l-6.7,21.39L30.29,17A8,8,0,0,0,16,24V136a80,80,0,0,0,160,0A8,8,0,0,0,160,128Z"/>',
  plate:         '<path fill="currentColor" d="M224,112H207.37a80.11,80.11,0,0,0-158.74,0H32a8,8,0,0,0,0,16H48.81A96.19,96.19,0,0,0,80,183.55V192a32,32,0,0,0,32,32h32a32,32,0,0,0,32-32v-8.45A96.19,96.19,0,0,0,207.19,128H224a8,8,0,0,0,0-16Zm-16,16A80.09,80.09,0,0,1,128,208a80.09,80.09,0,0,1-80-80V120H208Z"/>',

  // Atmosphere icons
  patio:         '<path fill="currentColor" d="M128,24a8,8,0,0,1,8,8V64l31-31a8,8,0,0,1,11.31,11.31L136,86.62V152a8,8,0,0,1-16,0V86.62L77.66,44.28A8,8,0,0,1,89,33L120,64V32A8,8,0,0,1,128,24Zm72,168H136V176a8,8,0,0,0-16,0v16H56a8,8,0,0,0,0,16H200a8,8,0,0,0,0-16Z"/>',
  music:         '<path fill="currentColor" d="M212.92,17.69a8,8,0,0,0-6.86-1.45l-128,32A8,8,0,0,0,72,56V166.08A36,36,0,1,0,88,196V62.32l112-28v99.76A36,36,0,1,0,216,168V24A8,8,0,0,0,212.92,17.69ZM52,216a20,20,0,1,1,20-20A20,20,0,0,1,52,216Zm128-32a20,20,0,1,1,20-20A20,20,0,0,1,180,184Z"/>',
  pet:           '<path fill="currentColor" d="M212,80a28,28,0,1,0-28,28A28,28,0,0,0,212,80Zm-28,12a12,12,0,1,1,12-12A12,12,0,0,1,184,92ZM72,108A28,28,0,1,0,44,80,28,28,0,0,0,72,108Zm-28-12a12,12,0,1,1,12-12A12,12,0,0,1,72,96ZM92,60A28,28,0,1,0,64,32,28,28,0,0,0,92,60Zm0-40A12,12,0,1,1,80,32,12,12,0,0,1,92,20Zm72,40a28,28,0,1,0-28-28A28,28,0,0,0,164,60Zm0-40a12,12,0,1,1-12,12A12,12,0,0,1,164,20Zm36.77,143.25a44,44,0,0,1-73.54,0C115.08,145.49,100.36,120,128,120S140.92,145.49,200.77,163.25Z"/>',

  // Star icons for Google rating
  starFull:      '<path fill="currentColor" d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,92l59.46-5.15,23.21-55.36a16.4,16.4,0,0,1,30.5,0l23.21,55.36L226.92,92a16.46,16.46,0,0,1,7.37,22.83Z"/>',
  starHalf:      '<path fill="currentColor" d="M234.29,114.85l-45,38.83L203,211.75a16.4,16.4,0,0,1-24.5,17.82L128,198.49V31.51a16.41,16.41,0,0,1,15.25,10l23.21,55.36L226.92,92a16.46,16.46,0,0,1,7.37,22.83ZM128,198.49,77.47,229.57A16.4,16.4,0,0,1,53,211.75l13.76-58.07-45-38.83A16.46,16.46,0,0,1,31.08,92l59.46-5.15,23.21-55.36A16.41,16.41,0,0,1,128,31.51Z" opacity="0.3"/>',
  starEmpty:     '<path fill="currentColor" d="M243,96.05a16.41,16.41,0,0,0-16.07-11.2l-59.46,5.15L144.26,34.64a16.4,16.4,0,0,0-30.5,0L90.54,90,31.08,84.85A16.46,16.46,0,0,0,21.74,114.85l45,38.83L53,211.75a16.4,16.4,0,0,0,24.5,17.82L128,198.49l50.53,31.08A16.4,16.4,0,0,0,203,211.75l-13.76-58.07,45-38.83A16.41,16.41,0,0,0,243,96.05Zm-57.58,48.79a8,8,0,0,0-2.56,7.91l14.41,60.83L146.1,183.12a8,8,0,0,0-8.2,0L86.73,213.58l14.41-60.83a8,8,0,0,0-2.56-7.91L49.48,102.76l62.24-5.39a8,8,0,0,0,6.7-4.89L128,33.15l9.58,59.33a8,8,0,0,0,6.7,4.89l62.24,5.39Z"/>',

  // Price & Noise icons
  dollarSign:    '<path fill="currentColor" d="M152,120H136V56h8a32,32,0,0,1,32,32,8,8,0,0,0,16,0,48.05,48.05,0,0,0-48-48h-8V24a8,8,0,0,0-16,0V40h-8a48,48,0,0,0,0,96h8v64H104a32,32,0,0,1-32-32,8,8,0,0,0-16,0,48.05,48.05,0,0,0,48,48h16v16a8,8,0,0,0,16,0V216h16a48,48,0,0,0,0-96Zm-40,0a32,32,0,0,1,0-64h8v64Zm24,80V136h16a32,32,0,0,1,0,64Z"/>',
  speakerWave:   '<path fill="currentColor" d="M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM144,207.64,84.91,161.69A7.94,7.94,0,0,0,80,160H32V96H80a7.94,7.94,0,0,0,4.91-1.69L144,48.36ZM192,128a24,24,0,0,0-24-24,8,8,0,0,0,0,16,8,8,0,0,1,0,16,8,8,0,0,0,0,16A24,24,0,0,0,192,128Zm40,0a64,64,0,0,0-64-64,8,8,0,0,0,0,16,48,48,0,0,1,0,96,8,8,0,0,0,0,16A64,64,0,0,0,232,128Z"/>',

  // Price tag icon
  tag:           '<path fill="currentColor" d="M243.31,136,144,36.69A15.86,15.86,0,0,0,132.69,32H40a8,8,0,0,0-8,8v92.69A15.86,15.86,0,0,0,36.69,144L136,243.31a16,16,0,0,0,22.63,0l84.68-84.68A16,16,0,0,0,243.31,136Zm-96,96L48,132.69V48h84.69L232,147.31ZM96,84A12,12,0,1,1,84,72,12,12,0,0,1,96,84Z"/>',

  // Ambiance icon (sun)
  sun:           '<path fill="currentColor" d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z"/>',

  // Dress code icon (shirt/t-shirt)
  shirt:         '<path fill="currentColor" d="M247.59,61.22,195.83,33A8,8,0,0,0,192,32H160a8,8,0,0,0-8,8,24,24,0,0,1-48,0,8,8,0,0,0-8-8H64a8,8,0,0,0-3.84,1L8.41,61.22A8,8,0,0,0,4.35,72.9l28,67.22A8,8,0,0,0,39.75,145l.25-.1V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V144.86l.25.1a8,8,0,0,0,7.4-4.84l28-67.22A8,8,0,0,0,247.59,61.22ZM200,216H56V136.59l24-10V152a8,8,0,0,0,16,0V119.74l.25-.11A8,8,0,0,0,100.35,109L38.79,134.07,16.31,80.05,60.69,48H93a40,40,0,0,0,70.1,0h32.28l44.31,32.05L217.21,134.07,155.65,109a8,8,0,0,0,4.1,10.62l.25.11V152a8,8,0,0,0,16,0V126.56l24,10Z"/>',

  // Parking icon
  car:           '<path fill="currentColor" d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM64,208H40V192H80v16Zm128,0V192h40v16Zm24-32H40V128H216Z"/>',

  // Utility icons
  pin:           '<path fill="currentColor" d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z"/>',
  refresh:       '<path fill="currentColor" d="M197.67,186.37a8,8,0,0,1,0,11.29C196.58,198.73,170.82,224,128,224c-37.39,0-64-24.36-80-48V200a8,8,0,0,1-16,0V160a8,8,0,0,1,8-8H80a8,8,0,0,1,0,16H54.29C67.84,190.3,90.78,208,128,208c36.27,0,58.13-21.44,58.36-21.68A8,8,0,0,1,197.67,186.37ZM216,40a8,8,0,0,0-8,8V72c-16-23.64-42.61-48-80-48-42.82,0-68.58,25.27-69.66,26.34a8,8,0,0,0,11.3,11.34C69.87,61.44,91.73,40,128,40c37.22,0,60.16,17.7,73.71,40H176a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V48A8,8,0,0,0,216,40Z"/>',
  chevronRight:  '<path fill="currentColor" d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z"/>',
  home:          '<path fill="currentColor" d="M218.83,103.77l-80-75.48a1.14,1.14,0,0,1-.11-.11,16,16,0,0,0-21.53,0l-.11.11L37.17,103.77A16,16,0,0,0,32,115.55V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V160h32v48a16,16,0,0,0,16,16h48a16,16,0,0,0,16-16V115.55A16,16,0,0,0,218.83,103.77ZM208,208H160V160a16,16,0,0,0-16-16H112a16,16,0,0,0-16,16v48H48V115.55l.11-.1L128,40l79.9,75.43.11.1Z"/>',

  // Action icons (Website, Call, Reviews, Share)
  globe:         '<path fill="currentColor" d="M128,28h0A100,100,0,1,0,228,128,100.11,100.11,0,0,0,128,28Zm0,190.61c-6.33-6.09-23-24.41-31.27-54.61h62.54C151,194.2,134.33,212.52,128,218.61ZM94.82,156a140.42,140.42,0,0,1,0-56h66.36a140.42,140.42,0,0,1,0,56ZM128,37.39c6.33,6.09,23,24.41,31.27,54.61H96.73C105,61.8,121.67,43.48,128,37.39ZM169.41,100h46.23a92.09,92.09,0,0,1,0,56H169.41a152.65,152.65,0,0,0,0-56Zm43.25-8h-45a129.39,129.39,0,0,0-29.19-55.4A92.25,92.25,0,0,1,212.66,92ZM117.54,36.6A129.39,129.39,0,0,0,88.35,92h-45A92.25,92.25,0,0,1,117.54,36.6ZM40.36,100H86.59a152.65,152.65,0,0,0,0,56H40.36a92.09,92.09,0,0,1,0-56Zm3,64h45a129.39,129.39,0,0,0,29.19,55.4A92.25,92.25,0,0,1,43.34,164Zm95.12,55.4A129.39,129.39,0,0,0,167.65,164h45A92.25,92.25,0,0,1,138.46,219.4Z"/>',
  phone:         '<path fill="currentColor" d="M220.78,162.13,173.56,141A12,12,0,0,0,162.18,142a3.37,3.37,0,0,0-.38.28L137,163.42a3.93,3.93,0,0,1-3.7.21c-16.24-7.84-33.05-24.52-40.89-40.57a3.9,3.9,0,0,1,.18-3.69l21.2-25.21c.1-.12.19-.25.28-.38a12,12,0,0,0,1-11.36L93.9,35.28a12,12,0,0,0-12.48-7.19A52.25,52.25,0,0,0,36,80c0,77.2,62.8,140,140,140a52.25,52.25,0,0,0,51.91-45.42A12,12,0,0,0,220.78,162.13ZM220,173.58A44.23,44.23,0,0,1,176,212C103.22,212,44,152.78,44,80A44.23,44.23,0,0,1,82.42,36a3.87,3.87,0,0,1,.48,0,4,4,0,0,1,3.67,2.49l21.11,47.14a4,4,0,0,1-.23,3.6l-21.19,25.2c-.1.13-.2.25-.29.39a12,12,0,0,0-.78,11.75c8.69,17.79,26.61,35.58,44.6,44.27a12,12,0,0,0,11.79-.87l.37-.28,24.83-21.12a3.93,3.93,0,0,1,3.57-.27l47.21,21.16A4,4,0,0,1,220,173.58Z"/>',
  starOutline:   '<path fill="currentColor" d="M235.36,98.49A12.21,12.21,0,0,0,224.59,90l-61.47-5L139.44,27.67a12.37,12.37,0,0,0-22.88,0L92.88,85,31.41,90a12.45,12.45,0,0,0-7.07,21.84l46.85,40.41L56.87,212.64a12.35,12.35,0,0,0,18.51,13.49L128,193.77l52.62,32.36a12.12,12.12,0,0,0,13.69-.51,12.28,12.28,0,0,0,4.82-13l-14.32-60.42,46.85-40.41A12.29,12.29,0,0,0,235.36,98.49Zm-8.93,7.26-48.68,42a4,4,0,0,0-1.28,3.95l14.87,62.79a4.37,4.37,0,0,1-1.72,4.65,4.24,4.24,0,0,1-4.81.18L130.1,185.67a4,4,0,0,0-4.2,0L71.19,219.32a4.24,4.24,0,0,1-4.81-.18,4.37,4.37,0,0,1-1.72-4.65L79.53,151.7a4,4,0,0,0-1.28-3.95l-48.68-42A4.37,4.37,0,0,1,28.25,101a4.31,4.31,0,0,1,3.81-3L96,92.79a4,4,0,0,0,3.38-2.46L124,30.73a4.35,4.35,0,0,1,8.08,0l24.62,59.6A4,4,0,0,0,160,92.79l63.9,5.15a4.31,4.31,0,0,1,3.81,3A4.37,4.37,0,0,1,226.43,105.75Z"/>',
  shareNetwork:  '<path fill="currentColor" d="M176,164a36,36,0,0,0-27.92,13.3L96.25,144a35.92,35.92,0,0,0,0-32L148.08,78.7A35.93,35.93,0,1,0,143.75,72L91.92,105.3a36,36,0,1,0,0,45.4L143.75,184A36,36,0,1,0,176,164Zm0-136a28,28,0,1,1-28,28A28,28,0,0,1,176,28ZM64,156a28,28,0,1,1,28-28A28,28,0,0,1,64,156Zm112,72a28,28,0,1,1,28-28A28,28,0,0,1,176,228Z"/>',
};

export function svgIcon(name, size = 16) {
  const path = ICON_SVG[name] || ICON_SVG.plate;
  return `<svg viewBox="0 0 256 256" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${path}</svg>`;
}

/* ---- Cuisine Mapping (icon-based, no emoji) ---- */
const CUISINE_MAP = [
  { keywords: ['sushi', 'japanese', 'ramen', 'izakaya', 'udon', 'soba'], hue: 210, icon: 'sushi' },
  { keywords: ['mexican', 'taco', 'burrito', 'enchilada', 'quesadilla'], hue: 28, icon: 'taco' },
  { keywords: ['italian', 'pasta', 'pizza', 'risotto', 'trattoria'], hue: 97, icon: 'pasta' },
  { keywords: ['indian', 'curry', 'tandoori', 'biryani', 'masala', 'naan'], hue: 37, icon: 'curry' },
  { keywords: ['thai', 'vietnamese', 'pho', 'pad thai', 'banh mi'], hue: 145, icon: 'noodles' },
  { keywords: ['chinese', 'dim sum', 'dumpling', 'wok', 'szechuan', 'cantonese'], hue: 5, icon: 'dumpling' },
  { keywords: ['korean', 'bbq', 'bibimbap', 'kimchi', 'bulgogi'], hue: 350, icon: 'meat' },
  { keywords: ['french', 'bistro', 'brasserie', 'croissant', 'patisserie'], hue: 45, icon: 'croissant' },
  { keywords: ['seafood', 'fish', 'lobster', 'crab', 'oyster', 'shrimp'], hue: 195, icon: 'seafood' },
  { keywords: ['steak', 'steakhouse', 'ribeye', 'filet'], hue: 10, icon: 'meat' },
  { keywords: ['burger', 'american', 'diner', 'wings', 'bbq'], hue: 35, icon: 'burger' },
  { keywords: ['coffee', 'cafe', 'espresso', 'latte', 'cappuccino'], hue: 30, icon: 'coffee' },
  { keywords: ['cocktail', 'bar', 'speakeasy', 'lounge', 'mixology'], hue: 280, icon: 'cocktail' },
  { keywords: ['vegan', 'vegetarian', 'plant-based', 'plant based'], hue: 130, icon: 'salad' },
  { keywords: ['brunch', 'breakfast', 'pancake', 'waffle', 'eggs'], hue: 40, icon: 'brunch' },
  { keywords: ['mediterranean', 'greek', 'falafel', 'hummus', 'shawarma'], hue: 50, icon: 'mediterranean' },
  { keywords: ['ethiopian', 'african', 'jollof', 'injera'], hue: 25, icon: 'stew' },
  { keywords: ['peruvian', 'ceviche', 'empanada'], hue: 15, icon: 'ceviche' },
];

export function matchCuisine(text) {
  if (!text) return { icon: 'plate', hue: null, label: '' };
  const lower = text.toLowerCase();
  for (const entry of CUISINE_MAP) {
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        return { icon: entry.icon, hue: entry.hue, label: kw };
      }
    }
  }
  return { icon: 'plate', hue: null, label: '' };
}

export function getCuisineFromResult(result) {
  if (!result?.restaurant) return matchCuisine('');
  const searchText = [
    result.restaurant.name,
    result.restaurant.best_for_oneliner,
    result.restaurant.cuisine_type,
    result.recommendation,
    ...(result.tags || []),
  ].filter(Boolean).join(' ');
  return matchCuisine(searchText);
}

/* ---- Time of Day ---- */
export function getTimePeriod() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 14) return 'lunch';
  if (h >= 14 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'dinner';
  return 'latenight';
}

export function getGreeting() {
  const period = getTimePeriod();
  const greetings = {
    morning: 'Good morning, what sounds good?',
    lunch: 'Lunchtime — what are you craving?',
    afternoon: 'Afternoon pick-me-up?',
    dinner: 'Good evening, what sounds good?',
    latenight: 'Late night cravings? We got you.',
  };
  return greetings[period];
}

// Quick picks data retained for potential future use (smart chips, etc.)
// Not currently rendered in the UI after quick-picks tile removal.
const QUICK_PICKS = {
  morning:   [
    { icon: 'brunch', label: 'Brunch', value: 'Brunch spot' },
    { icon: 'coffee', label: 'Coffee', value: 'Great coffee shop' },
    { icon: 'croissant', label: 'Bakery', value: 'Fresh bakery' },
    { icon: 'salad', label: 'Healthy', value: 'Healthy breakfast' },
  ],
  lunch: [
    { icon: 'taco', label: 'Quick Bite', value: 'Quick lunch' },
    { icon: 'salad', label: 'Healthy', value: 'Healthy lunch' },
    { icon: 'noodles', label: 'Noodles', value: 'Noodle soup' },
    { icon: 'taco', label: 'Tacos', value: 'Great tacos' },
  ],
  afternoon: [
    { icon: 'coffee', label: 'Coffee', value: 'Best coffee' },
    { icon: 'croissant', label: 'Snacks', value: 'Good snacks and pastries' },
    { icon: 'cocktail', label: 'Happy Hour', value: 'Happy hour drinks' },
    { icon: 'coffee', label: 'Tea', value: 'Tea house' },
  ],
  dinner: [
    { icon: 'cocktail', label: 'Date Night', value: 'Romantic date night' },
    { icon: 'cocktail', label: 'Drinks', value: 'Great cocktails and drinks' },
    { icon: 'plate', label: 'Trendy', value: 'Trendy new restaurant' },
    { icon: 'plate', label: 'Family', value: 'Family friendly dinner' },
  ],
  latenight: [
    { icon: 'plate', label: 'Late Night', value: 'Late night food' },
    { icon: 'cocktail', label: 'Cocktails', value: 'Late night cocktail bar' },
    { icon: 'burger', label: 'Comfort', value: 'Comfort food late night' },
    { icon: 'pasta', label: 'Pizza', value: 'Late night pizza' },
  ],
};

/* ---- Match System (Percentage-based, 0-100) ---- */
const MATCH_WORDS = {
  90: 'Perfect For You',
  80: 'Excellent Match',
  70: 'Great Match',
  60: 'Good Match',
  50: 'Worth a Try',
  0:  'Adventurous',
};
const MATCH_THRESHOLDS = [90, 80, 70, 60, 50, 0];

export function getScoreTier(score) {
  const pct = Math.round(parseFloat(score) || 80);
  const clamped = Math.max(0, Math.min(100, pct));
  const matched = MATCH_THRESHOLDS.find(t => clamped >= t);
  const verdict = MATCH_WORDS[matched];
  let tier, cssClass;
  if (clamped >= 80) { tier = 'high'; cssClass = 'score-verdict--high'; }
  else if (clamped >= 60) { tier = 'mid'; cssClass = 'score-verdict--mid'; }
  else { tier = 'low'; cssClass = 'score-verdict--low'; }
  return { tier, verdict, cssClass, integer: clamped };
}

export function getScoreColor(score) {
  const pct = Math.round(parseFloat(score) || 80);
  if (pct >= 80) return 'var(--green)';
  if (pct >= 60) return 'var(--ac)';
  return 'var(--rose)';
}

export function buildGoogleStars(rating) {
  const n = parseFloat(rating) || 0;
  const full = Math.floor(n);
  const half = n - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  let html = '';
  for (let i = 0; i < full; i++) html += svgIcon('starFull', 14);
  if (half) html += svgIcon('starHalf', 14);
  for (let i = 0; i < empty; i++) html += svgIcon('starEmpty', 14);
  return html;
}

export function buildMapsUrl(address) {
  if (!address) return '#';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function relativeTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function buildShareText(result) {
  if (!result?.restaurant) return '';
  const r = result.restaurant;
  const parts = [
    r.name,
    r.best_for_oneliner ? `"${r.best_for_oneliner}"` : '',
    result.recommendation ? `\n${result.recommendation}` : '',
    result.insider_tip ? `\nTip: ${result.insider_tip}` : '',
    r.address ? `\n${r.address}` : '',
    r.website || '',
    '\n— via DondeAI',
  ];
  return parts.filter(Boolean).join('\n');
}

/* ---- Noise Level Normalization ---- */
export function normalizeNoiseLevel(noiseStr) {
  if (!noiseStr) return null;
  const lower = noiseStr.toLowerCase();
  if (lower.includes('quiet') || lower.includes('soft') || lower.includes('whisper')) return 2;
  if (lower.includes('very loud') || lower.includes('boisterous') || lower.includes('roaring')) return 9;
  if (lower.includes('loud') || lower.includes('lively') || lower.includes('energetic')) return 7;
  if (lower.includes('moderate') || lower.includes('normal') || lower.includes('average')) return 5;
  return 5; // default moderate
}
