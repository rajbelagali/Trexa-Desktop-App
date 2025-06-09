function startVoice() {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-US";
  recognition.onresult = (event) => {
    const command = event.results[0][0].transcript;
    console.log("Heard:", command);
    document.querySelector('.status').textContent = '🗣️ ' + command;
  };
  recognition.start();
}

// window.mainAPI.onAction((data) => {
//   console.log("main action coming for dictate");
//   if (data === 'click-login') {
//     document.querySelector('.dictation-new-btn')?.click(); // replace with actual selector
//   }
// });

function stopApp() {
  const { remote } = require('electron');
  remote.getCurrentWindow().close();
}
