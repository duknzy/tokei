let timerId = null;

self.onmessage = function(e) {
  if (e.data === 'START') {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      self.postMessage('TICK');
    }, 100); // 100msごとにメインスレッドへ拍動を通知
  } else if (e.data === 'STOP') {
    clearInterval(timerId);
    timerId = null;
  }
};