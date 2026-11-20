/* SmartBeam presenter: renders PDF pages, images and video full-screen. Shared by the Cast receiver and the browser room. */
(function (global) {
  'use strict';
  var PDFJS_VERSION = '3.11.174';

  function SmartBeamPresenter(root, opts) {
    opts = opts || {};
    this.root = root;
    this.onError = opts.onError || function () {};
    this.canvas = root.querySelector('#pdf');
    this.img = root.querySelector('#img');
    this.video = root.querySelector('#vid');
    this.black = root.querySelector('#black');
    this.pointer = root.querySelector('#pointer');
    this.badge = root.querySelector('#badge');
    this.status = root.querySelector('#status');
    this.doc = null; this.url = null; this.page = 1; this.token = 0; this.kind = null;
    var self = this;
    window.addEventListener('resize', function () { if (self.kind === 'pdf') self.render(); });
    if (global.pdfjsLib) global.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VERSION + '/pdf.worker.min.js';
  }

  SmartBeamPresenter.prototype.showStatus = function (text) {
    this.status.textContent = text || '';
    this.status.style.display = text ? 'block' : 'none';
  };

  SmartBeamPresenter.prototype._layer = function (name) {
    this.canvas.style.display = name === 'pdf' ? 'block' : 'none';
    this.img.style.display = name === 'img' ? 'block' : 'none';
    this.video.style.display = name === 'vid' ? 'block' : 'none';
    if (name !== 'vid') { try { this.video.pause(); } catch (e) {} }
  };

  SmartBeamPresenter.prototype.clear = function () {
    this.token++; this.doc = null; this.url = null; this.kind = null;
    this._layer('none'); this.video.removeAttribute('src'); this.img.removeAttribute('src');
    this.setBlackout(false); this.setPaused(false); this.setPointer(0, 0, false);
  };

  SmartBeamPresenter.prototype.load = function (content, page) {
    var self = this;
    this.clear();
    this.showStatus('Loading…');
    this.kind = content.kind;
    if (content.kind === 'pdf') {
      if (!global.pdfjsLib) return Promise.reject(new Error('PDF renderer unavailable (no internet access to load pdf.js).'));
      this.url = content.url;
      return global.pdfjsLib.getDocument({ url: content.url }).promise.then(function (doc) {
        self.doc = doc; self.page = Math.min(Math.max(1, page || 1), doc.numPages);
        return self.render().then(function () { self.showStatus(''); return { page: self.page, total: doc.numPages }; });
      });
    }
    if (content.kind === 'image') {
      return new Promise(function (resolve, reject) {
        self.img.onload = function () { self._layer('img'); self.showStatus(''); resolve({ page: 1, total: 1 }); };
        self.img.onerror = function () { reject(new Error('The image could not be loaded.')); };
        self.img.src = content.url;
      });
    }
    if (content.kind === 'video') {
      return new Promise(function (resolve, reject) {
        self.video.onloadeddata = function () { self._layer('vid'); self.showStatus(''); self.video.play().catch(function () {}); resolve({ page: 1, total: 1 }); };
        self.video.onerror = function () { reject(new Error('The video could not be played.')); };
        self.video.src = content.url;
      });
    }
    return Promise.reject(new Error('Unsupported content type: ' + content.kind));
  };

  SmartBeamPresenter.prototype.render = function () {
    var self = this;
    if (!this.doc) return Promise.resolve();
    var token = ++this.token;
    return this.doc.getPage(this.page).then(function (page) {
      if (token !== self.token) return;
      var base = page.getViewport({ scale: 1 });
      var scale = Math.min(window.innerWidth / base.width, window.innerHeight / base.height);
      var ratio = window.devicePixelRatio || 1;
      var vp = page.getViewport({ scale: scale * ratio });
      self.canvas.width = vp.width; self.canvas.height = vp.height;
      self.canvas.style.width = (vp.width / ratio) + 'px'; self.canvas.style.height = (vp.height / ratio) + 'px';
      self._layer('pdf');
      return page.render({ canvasContext: self.canvas.getContext('2d'), viewport: vp }).promise;
    });
  };

  SmartBeamPresenter.prototype.goto = function (n) {
    if (!this.doc) return Promise.resolve();
    this.page = Math.min(Math.max(1, n), this.doc.numPages);
    return this.render().then(function () {});
  };

  SmartBeamPresenter.prototype.setBlackout = function (on) { this.black.style.display = on ? 'block' : 'none'; };
  SmartBeamPresenter.prototype.setPaused = function (on) { this.badge.style.display = on ? 'block' : 'none'; };
  SmartBeamPresenter.prototype.setPointer = function (x, y, visible) {
    this.pointer.style.display = visible ? 'block' : 'none';
    if (visible) { this.pointer.style.left = (x * 100) + '%'; this.pointer.style.top = (y * 100) + '%'; }
  };
  SmartBeamPresenter.prototype.videoControl = function (action, value) {
    var v = this.video;
    if (action === 'play') v.play(); else if (action === 'pause') v.pause();
    else if (action === 'seek') v.currentTime = value / 1000; else if (action === 'volume') v.volume = value;
    else if (action === 'stop') { v.pause(); }
  };

  global.SmartBeamPresenter = SmartBeamPresenter;
})(window);
