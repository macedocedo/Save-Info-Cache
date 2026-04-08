/* ============================================================
   Fórum — script.js
   Compatível com GitHub Pages (apenas localStorage, zero deps)
   ============================================================ */

// ── Estado global ──────────────────────────────────────────
var posts      = [];
var categories = [];
var activeCategory  = null;
var currentSort     = 'recent';
var editingPostId   = null;
var viewingPostId   = null;
var activeMediaTab  = 'none';
var uploadedImgData = null;

// ── Persistência ───────────────────────────────────────────
function loadData() {
  try {
    var p = localStorage.getItem('forum_posts');
    var c = localStorage.getItem('forum_cats');
    posts      = p ? JSON.parse(p) : [];
    categories = c ? JSON.parse(c) : ['Geral', 'Notícias', 'Perguntas', 'Projetos'];
  } catch (e) {
    posts = [];
    categories = ['Geral', 'Notícias', 'Perguntas', 'Projetos'];
  }
}

function saveData() {
  try {
    localStorage.setItem('forum_posts', JSON.stringify(posts));
    localStorage.setItem('forum_cats',  JSON.stringify(categories));
  } catch (e) {
    console.warn('localStorage indisponível', e);
  }
}

// ── Utilitários ────────────────────────────────────────────
function uid() {
  return 'p' + Date.now() + Math.random().toString(36).slice(2, 6);
}

function getInitials(name) {
  if (!name || !name.trim()) return '?';
  return name.trim().split(/\s+/).map(function(w){ return w[0]; }).join('').toUpperCase().slice(0,2);
}

function timeAgo(ts) {
  var diff = Date.now() - ts;
  var m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora mesmo';
  if (m < 60) return m + 'min atrás';
  var h = Math.floor(m / 60);
  if (h < 24) return h + 'h atrás';
  var d = Math.floor(h / 24);
  if (d < 30) return d + 'd atrás';
  return new Date(ts).toLocaleDateString('pt-BR');
}

var COLOR_PALETTE = ['#2d7d46','#1a5ca8','#8b3a3a','#5a2d7d','#8b6914','#2d5a7d','#7d5a2d'];
function catColor(str) {
  if (!str) return COLOR_PALETTE[0];
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return COLOR_PALETTE[Math.abs(h) % COLOR_PALETTE.length];
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getEmbedUrl(url) {
  try {
    var u = new URL(url);
    if (u.hostname.indexOf('youtube.com') !== -1 || u.hostname.indexOf('youtu.be') !== -1) {
      var vid = u.searchParams.get('v') || u.pathname.split('/').pop();
      return 'https://www.youtube.com/embed/' + vid;
    }
    if (u.hostname.indexOf('vimeo.com') !== -1) {
      var vid2 = u.pathname.split('/').pop();
      return 'https://player.vimeo.com/video/' + vid2;
    }
  } catch(e) {}
  return url;
}

// ── Toast ──────────────────────────────────────────────────
var toastTimer = null;
function showToast(msg) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('show'); }, 2400);
}

// ── Categorias — Render ─────────────────────────────────────
function renderCategories() {
  var list = document.getElementById('cat-list');
  if (!list) return;

  var html = buildCatItem(null, 'Todas', '#888888', posts.length, activeCategory === null);

  for (var i = 0; i < categories.length; i++) {
    var cat   = categories[i];
    var count = 0;
    for (var j = 0; j < posts.length; j++) {
      if (posts[j].category === cat) count++;
    }
    html += buildCatItem(i, cat, catColor(cat), count, activeCategory === cat);
  }

  list.innerHTML = html;

  // info
  var ip = document.getElementById('info-posts');
  var ic = document.getElementById('info-cats');
  if (ip) ip.textContent = posts.length + (posts.length !== 1 ? ' publicações' : ' publicação');
  if (ic) ic.textContent = categories.length + (categories.length !== 1 ? ' categorias' : ' categoria');

  // populate select
  var sel = document.getElementById('f-cat');
  if (sel) {
    sel.innerHTML = '<option value="">Sem categoria</option>';
    for (var k = 0; k < categories.length; k++) {
      var opt = document.createElement('option');
      opt.value = categories[k];
      opt.textContent = categories[k];
      sel.appendChild(opt);
    }
  }
}

function buildCatItem(index, label, color, count, isActive) {
  var activeClass = isActive ? ' active' : '';
  var clickFn = index === null ? 'setCategory(null)' : 'setCategory(' + index + ')';
  return '<div class="category-item' + activeClass + '" onclick="' + clickFn + '">' +
    '<span class="category-dot" style="background:' + color + '"></span>' +
    '<span id="cat-label-' + index + '">' + escapeHtml(label) + '</span>' +
    '<span class="category-count">' + count + '</span>' +
    (index !== null
      ? '<div class="cat-actions">' +
          '<button class="cat-btn" title="Renomear" onclick="event.stopPropagation();startEditCat(' + index + ')">&#9998;</button>' +
          '<button class="cat-btn del" title="Excluir" onclick="event.stopPropagation();deleteCategory(' + index + ')">&#128465;</button>' +
        '</div>'
      : '<div class="cat-actions"></div>') +
  '</div>';
}

// ── Categorias — Ações ──────────────────────────────────────
function setCategory(indexOrNull) {
  if (indexOrNull === null) {
    activeCategory = null;
  } else {
    activeCategory = categories[indexOrNull] || null;
  }
  var title    = document.getElementById('page-title');
  var subtitle = document.getElementById('page-subtitle');
  if (title)    title.textContent    = activeCategory || 'Todas as Publicações';
  if (subtitle) subtitle.textContent = activeCategory
    ? posts.filter(function(p){ return p.category === activeCategory; }).length + ' publicações'
    : 'Bem-vindo ao Save-Cache';
  renderCategories();
  renderPosts();
}

function toggleAddCat() {
  var f = document.getElementById('add-cat-form');
  if (!f) return;
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    var inp = document.getElementById('new-cat-input');
    if (inp) inp.focus();
  }
}

function confirmAddCat() {
  var inp  = document.getElementById('new-cat-input');
  if (!inp) return;
  var name = inp.value.trim();
  if (!name) return;
  if (categories.indexOf(name) !== -1) { showToast('Categoria já existe'); return; }
  categories.push(name);
  saveData();
  inp.value = '';
  var f = document.getElementById('add-cat-form');
  if (f) f.classList.remove('open');
  renderCategories();
  showToast('Categoria adicionada');
}

function startEditCat(i) {
  var span = document.getElementById('cat-label-' + i);
  if (!span) return;
  var oldName = categories[i];
  span.outerHTML =
    '<input class="cat-edit-input" id="cat-edit-' + i + '" value="' + escapeHtml(oldName) + '" maxlength="30"' +
    ' onkeydown="handleCatEditKey(event,' + i + ')" />' +
    '<button class="cat-edit-ok" onclick="confirmEditCat(' + i + ')">&#10003;</button>';
  var inp = document.getElementById('cat-edit-' + i);
  if (inp) { inp.focus(); inp.select(); }
}

function handleCatEditKey(e, i) {
  if (e.key === 'Enter')  confirmEditCat(i);
  if (e.key === 'Escape') renderCategories();
}

function confirmEditCat(i) {
  var inp = document.getElementById('cat-edit-' + i);
  if (!inp) return;
  var newName = inp.value.trim();
  if (!newName) { renderCategories(); return; }
  var oldName = categories[i];
  categories[i] = newName;
  for (var j = 0; j < posts.length; j++) {
    if (posts[j].category === oldName) posts[j].category = newName;
  }
  if (activeCategory === oldName) activeCategory = newName;
  saveData();
  renderCategories();
  renderPosts();
  showToast('Categoria renomeada');
}

function deleteCategory(i) {
  var name = categories[i];
  if (!confirm('Excluir categoria "' + name + '"?\nAs publicações ficarão sem categoria.')) return;
  categories.splice(i, 1);
  for (var j = 0; j < posts.length; j++) {
    if (posts[j].category === name) posts[j].category = '';
  }
  if (activeCategory === name) activeCategory = null;
  saveData();
  renderCategories();
  renderPosts();
  showToast('Categoria excluída');
}

// ── Ordenação ───────────────────────────────────────────────
function setSort(s) {
  currentSort = s;
  var btns = document.querySelectorAll('.sort-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].getAttribute('data-sort') === s);
  }
  renderPosts();
}

function getSortedPosts() {
  var list = activeCategory
    ? posts.filter(function(p){ return p.category === activeCategory; })
    : posts.slice();

  if (currentSort === 'recent') {
    list.sort(function(a,b){ return b.ts - a.ts; });
  } else if (currentSort === 'oldest') {
    list.sort(function(a,b){ return a.ts - b.ts; });
  } else {
    list.sort(function(a,b){ return a.title.localeCompare(b.title, 'pt-BR'); });
  }

  var pinned = list.filter(function(p){ return p.pinned; });
  var rest   = list.filter(function(p){ return !p.pinned; });
  return pinned.concat(rest);
}

// ── Render Posts ────────────────────────────────────────────
function renderPosts() {
  var container = document.getElementById('posts-container');
  if (!container) return;
  var list = getSortedPosts();

  if (!list.length) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="ei">&#128205;</div>' +
        '<h3>Nenhuma publicação ainda</h3>' +
        '<p>Clique em "Nova Publicação" para começar!</p>' +
      '</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < list.length; i++) {
    html += buildPostCard(list[i]);
  }
  container.innerHTML = html;
}

function buildPostCard(p) {
  var color = catColor(p.author);
  var bg    = color + '22';

  var badges = '';
  if (p.category) badges += '<span class="tag cat-tag">' + escapeHtml(p.category) + '</span>';
  if (p.pinned)   badges += '<span class="tag pin-tag">&#128204; Fixado</span>';

  var mediaBadge = '';
  if (p.mediaType === 'img')   mediaBadge = '<span class="media-badge">&#128444; Imagem</span>';
  if (p.mediaType === 'video') mediaBadge = '<span class="media-badge">&#127909; Vídeo</span>';
  if (p.mediaType === 'embed') mediaBadge = '<span class="media-badge">&#9654; Vídeo incorporado</span>';

  var thumb = '';
  if (p.mediaType === 'img' && p.mediaSrc) {
    thumb = '<img class="post-img-thumb" src="' + escapeHtml(p.mediaSrc) + '" alt="" onerror="this.style.display=\'none\'" />';
  }

  return '<div class="post-card' + (p.pinned ? ' pinned' : '') + '" onclick="viewPost(\'' + p.id + '\')">' +
    '<div class="post-card-inner">' +
      '<div class="post-card-body">' +
        '<div class="post-meta">' +
          '<div class="avatar" style="background:' + bg + ';color:' + color + '">' + getInitials(p.author) + '</div>' +
          '<span class="post-author">' + escapeHtml(p.author || 'Anônimo') + '</span>' +
          '<span class="post-date">'   + timeAgo(p.ts) + '</span>' +
          badges +
        '</div>' +
        '<div class="post-title">'   + escapeHtml(p.title)      + '</div>' +
        '<div class="post-excerpt">' + escapeHtml(p.body || '') + '</div>' +
        mediaBadge +
      '</div>' +
      thumb +
    '</div>' +
  '</div>';
}

// ── View Post ────────────────────────────────────────────────
function viewPost(id) {
  var p = findPost(id);
  if (!p) return;
  viewingPostId = id;

  var catTag = document.getElementById('view-cat-tag');
  if (catTag) catTag.textContent = p.category || 'Sem categoria';

  var mediaHtml = '';
  if (p.mediaType === 'img' && p.mediaSrc) {
    mediaHtml = '<div class="post-view-media"><img src="' + escapeHtml(p.mediaSrc) + '" alt="" /></div>';
  } else if (p.mediaType === 'video' && p.mediaSrc) {
    mediaHtml = '<div class="post-view-media"><video controls src="' + escapeHtml(p.mediaSrc) + '"></video></div>';
  } else if (p.mediaType === 'embed' && p.mediaSrc) {
    var embedUrl = getEmbedUrl(p.mediaSrc);
    mediaHtml =
      '<div class="post-view-media" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden">' +
        '<iframe src="' + escapeHtml(embedUrl) + '" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allowfullscreen></iframe>' +
      '</div>';
  }

  var vc = document.getElementById('view-content');
  if (vc) {
    vc.innerHTML =
      '<div class="post-view-content">' +
        '<div class="post-view-title">' + escapeHtml(p.title) + '</div>' +
        mediaHtml +
        '<div class="post-view-body">' + escapeHtml(p.body || '') + '</div>' +
      '</div>';
  }

  var color = catColor(p.author);
  var vm = document.getElementById('view-meta');
  if (vm) {
    vm.innerHTML =
      '<div class="avatar" style="background:' + color + '22;color:' + color + '">' + getInitials(p.author) + '</div>' +
      '<span style="font-weight:500;font-size:14px">' + escapeHtml(p.author || 'Anônimo') + '</span>' +
      '<span style="font-size:13px;color:var(--text3)">' + new Date(p.ts).toLocaleString('pt-BR') + '</span>' +
      (p.pinned ? '<span class="tag pin-tag">&#128204; Fixado</span>' : '');
  }

  openOverlay('view-overlay');
}

function closeView() {
  closeOverlay('view-overlay');
  viewingPostId = null;
}

function editCurrentPost() {
  var p = findPost(viewingPostId);
  if (!p) return;
  closeView();
  editingPostId = p.id;

  setText('form-modal-title', 'Editar Publicação');
  setVal('f-title',  p.title  || '');
  setVal('f-body',   p.body   || '');
  setVal('f-author', p.author || '');
  setChecked('f-pin', !!p.pinned);

  renderCategories();
  setVal('f-cat', p.category || '');

  clearMediaForm();
  if (p.mediaType === 'img' && p.mediaSrc) {
    switchTab('img-url');
    setVal('f-img-url', p.mediaSrc);
    previewImgUrl();
  } else if (p.mediaType === 'video' && p.mediaSrc) {
    switchTab('video-url');
    setVal('f-video-url', p.mediaSrc);
  } else if (p.mediaType === 'embed' && p.mediaSrc) {
    switchTab('video-embed');
    setVal('f-video-embed', p.mediaSrc);
  } else {
    switchTab('none');
  }

  openOverlay('new-post-overlay');
}

function deleteCurrentPost() {
  if (!confirm('Excluir esta publicação?')) return;
  posts = posts.filter(function(p){ return p.id !== viewingPostId; });
  saveData();
  closeView();
  renderCategories();
  renderPosts();
  showToast('Publicação excluída');
}

// ── New Post ────────────────────────────────────────────────
function openNewPost() {
  editingPostId = null;
  setText('form-modal-title', 'Nova Publicação');
  setVal('f-title', ''); setVal('f-body', ''); setVal('f-author', '');
  setChecked('f-pin', false);
  clearMediaForm();
  renderCategories();
  openOverlay('new-post-overlay');
}

function closeNewPost() {
  closeOverlay('new-post-overlay');
}

function clearMediaForm() {
  setVal('f-img-url', ''); setVal('f-video-url', ''); setVal('f-video-embed', '');
  hide('img-url-preview'); hide('img-upload-preview');
  uploadedImgData = null;
  switchTab('none');
}

function submitPost() {
  var title  = (getVal('f-title')  || '').trim();
  var body   = (getVal('f-body')   || '').trim();
  var author = (getVal('f-author') || '').trim() || 'Anônimo';
  var cat    = getVal('f-cat') || '';
  var pinned = getChecked('f-pin');

  if (!title) { showToast('Insira um título'); return; }

  var mediaType = null, mediaSrc = null;
  if (activeMediaTab === 'img-url') {
    var u1 = (getVal('f-img-url') || '').trim();
    if (u1) { mediaType = 'img'; mediaSrc = u1; }
  } else if (activeMediaTab === 'img-upload') {
    if (uploadedImgData) { mediaType = 'img'; mediaSrc = uploadedImgData; }
  } else if (activeMediaTab === 'video-url') {
    var u2 = (getVal('f-video-url') || '').trim();
    if (u2) { mediaType = 'video'; mediaSrc = u2; }
  } else if (activeMediaTab === 'video-embed') {
    var u3 = (getVal('f-video-embed') || '').trim();
    if (u3) { mediaType = 'embed'; mediaSrc = u3; }
  }

  if (editingPostId) {
    var p = findPost(editingPostId);
    if (p) {
      p.title = title; p.body = body; p.author = author;
      p.category = cat; p.pinned = pinned;
      p.mediaType = mediaType; p.mediaSrc = mediaSrc;
      p.editedAt = Date.now();
    }
    showToast('Publicação atualizada!');
  } else {
    posts.unshift({ id: uid(), title: title, body: body, author: author,
      category: cat, pinned: pinned, mediaType: mediaType, mediaSrc: mediaSrc, ts: Date.now() });
    showToast('Publicação criada!');
  }

  uploadedImgData = null;
  saveData();
  closeNewPost();
  renderCategories();
  renderPosts();
}

// ── Media tabs ──────────────────────────────────────────────
function switchTab(tab) {
  activeMediaTab = tab;
  var tabIds = ['none','img-url','img-upload','video-url','video-embed'];
  var tabs   = document.querySelectorAll('.media-tab');
  var secs   = document.querySelectorAll('.media-section');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabIds[i] === tab);
  }
  for (var j = 0; j < secs.length; j++) {
    secs[j].classList.remove('active');
  }
  var sec = document.getElementById('tab-' + tab);
  if (sec) sec.classList.add('active');
}

function previewImgUrl() {
  var url  = (getVal('f-img-url') || '').trim();
  var prev = document.getElementById('img-url-preview');
  var img  = document.getElementById('img-url-thumb');
  if (!prev || !img) return;
  if (url) { prev.style.display = 'block'; img.src = url; }
  else     { prev.style.display = 'none'; img.src = ''; }
}

function handleImgUpload() {
  var input = document.getElementById('f-img-file');
  if (!input || !input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    uploadedImgData = e.target.result;
    var prev = document.getElementById('img-upload-preview');
    var img  = document.getElementById('img-upload-thumb');
    if (prev) prev.style.display = 'block';
    if (img)  img.src = uploadedImgData;
  };
  reader.readAsDataURL(input.files[0]);
}

// Drag & drop
(function() {
  var area = document.getElementById('upload-area');
  if (!area) return;
  area.addEventListener('dragover', function(e) {
    e.preventDefault();
    area.classList.add('dragover');
  });
  area.addEventListener('dragleave', function() {
    area.classList.remove('dragover');
  });
  area.addEventListener('drop', function(e) {
    e.preventDefault();
    area.classList.remove('dragover');
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && file.type.indexOf('image/') === 0) {
      var input = document.getElementById('f-img-file');
      if (input) {
        try {
          var dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
        } catch(err) {}
      }
      var reader = new FileReader();
      reader.onload = function(ev) {
        uploadedImgData = ev.target.result;
        var prev = document.getElementById('img-upload-preview');
        var img  = document.getElementById('img-upload-thumb');
        if (prev) prev.style.display = 'block';
        if (img)  img.src = uploadedImgData;
      };
      reader.readAsDataURL(file);
    }
  });
})();

// ── Search ──────────────────────────────────────────────────
function openSearch() {
  openOverlay('search-overlay');
  setTimeout(function(){ var el = document.getElementById('search-input'); if (el) el.focus(); }, 60);
}

function closeSearch() {
  closeOverlay('search-overlay');
  setVal('search-input', '');
  var res = document.getElementById('search-results');
  if (res) res.innerHTML = '';
}

function doSearch() {
  var q   = (getVal('search-input') || '').toLowerCase().trim();
  var res = document.getElementById('search-results');
  if (!res) return;
  if (!q) { res.innerHTML = ''; return; }

  var found = posts.filter(function(p) {
    return (p.title     || '').toLowerCase().indexOf(q) !== -1 ||
           (p.body      || '').toLowerCase().indexOf(q) !== -1 ||
           (p.author    || '').toLowerCase().indexOf(q) !== -1 ||
           (p.category  || '').toLowerCase().indexOf(q) !== -1;
  });

  if (!found.length) {
    res.innerHTML = '<p style="font-size:14px;color:var(--text3);margin-top:6px">Nenhum resultado encontrado.</p>';
    return;
  }

  var html = '';
  for (var i = 0; i < found.length; i++) {
    var p = found[i];
    html += '<div class="search-card" onclick="closeSearch();viewPost(\'' + p.id + '\')">' +
      (p.category ? '<span class="tag cat-tag" style="margin-bottom:4px;display:inline-block">' + escapeHtml(p.category) + '</span>' : '') +
      '<div class="search-card-title">' + escapeHtml(p.title) + '</div>' +
      '<div class="search-card-meta">' + escapeHtml(p.author || 'Anônimo') + ' &middot; ' + timeAgo(p.ts) + '</div>' +
    '</div>';
  }
  res.innerHTML = html;
}

// ── Overlay helpers ─────────────────────────────────────────
function openOverlay(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('open');
}
function closeOverlay(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
function closeOnBg(e, id) {
  if (e.target && e.target.id === id) {
    if (id === 'view-overlay')      closeView();
    else if (id === 'new-post-overlay') closeNewPost();
    else if (id === 'search-overlay')   closeSearch();
  }
}

// ── DOM helpers ─────────────────────────────────────────────
function findPost(id) {
  for (var i = 0; i < posts.length; i++) { if (posts[i].id === id) return posts[i]; }
  return null;
}
function getVal(id)       { var el = document.getElementById(id); return el ? el.value : ''; }
function setVal(id, v)    { var el = document.getElementById(id); if (el) el.value = v; }
function setText(id, v)   { var el = document.getElementById(id); if (el) el.textContent = v; }
function getChecked(id)   { var el = document.getElementById(id); return el ? el.checked : false; }
function setChecked(id,v) { var el = document.getElementById(id); if (el) el.checked = v; }
function hide(id)         { var el = document.getElementById(id); if (el) el.style.display = 'none'; }

// ── Keyboard ────────────────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeView(); closeNewPost(); closeSearch(); }
});

document.addEventListener('keydown', function(e) {
  var inp = document.getElementById('new-cat-input');
  if (document.activeElement === inp) {
    if (e.key === 'Enter')  { confirmAddCat(); }
    if (e.key === 'Escape') {
      setVal('new-cat-input', '');
      var f = document.getElementById('add-cat-form');
      if (f) f.classList.remove('open');
    }
  }
});

// ── Init ────────────────────────────────────────────────────
loadData();

if (!posts.length) {
  posts = [
    { id: uid(), title: 'Bem-vindo ao Fórum!',
      body: 'Este é um espaço para compartilhar ideias, perguntas e projetos.\n\nUse as categorias na barra lateral para organizar suas publicações. Você pode adicionar imagens, vídeos e muito mais!',
      author: 'Admin', category: 'Geral', pinned: true, mediaType: null, mediaSrc: null, ts: Date.now() - 10000 },
    { id: uid(), title: 'Como funciona este fórum?',
      body: 'Você pode criar publicações com texto, imagens (via URL ou upload) e vídeos.\n\nNa barra lateral é possível adicionar, renomear e excluir categorias. Clique em qualquer publicação para visualizá-la completa.',
      author: 'Usuário', category: 'Perguntas', pinned: false, mediaType: null, mediaSrc: null, ts: Date.now() - 5000 }
  ];
  saveData();
}

renderCategories();
renderPosts();
