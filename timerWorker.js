let timerId = null;

self.onmessage = function(e) {
  if (e.data === 'START') {
    timerId = setInterval(() => {
      self.postMessage('TICK');
    }, 100); // 100msごとに拍動を送信
  } else if (e.data === 'STOP') {
    clearInterval(timerId);
    timerId = null;
  }
};