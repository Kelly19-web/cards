/* ==========================
   GLOBAL STATE + LOCALSTORAGE
========================== */
let shelves = [];        // [{ name, books: [ { id, src } ] }]
let croppedBase64 = null;
let cropInstance = null;
let cameraStream = null;

const STORAGE_KEY = "cards_shelves_v1";

/* Load from localStorage on start */
window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      shelves = JSON.parse(saved);
    } catch {
      shelves = [];
    }
  }
  renderShelves();
});

/* Save to localStorage */
function saveShelves() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shelves));
}

/* ==========================
   DOM ELEMENTS
========================== */
const addBookBtn      = document.getElementById("addBookBtn");
const popup           = document.getElementById("addBookModal");
const closePopupBtn   = document.getElementById("closePopupBtn");

const stepTakePhoto   = document.getElementById("stepTakePhoto");
const stepShelf       = document.getElementById("stepShelf");

const cameraPreview   = document.getElementById("cameraPreview");
const cropContainer   = document.getElementById("cropContainer");
const cropImage       = document.getElementById("cropImage");
const confirmCropBtn  = document.getElementById("confirmCropBtn");

const shelfInput      = document.getElementById("shelfInput");
const saveBookBtn     = document.getElementById("saveBookBtn");

const shelvesList     = document.querySelector(".shelves-list");

/* Viewer */
const imageViewer   = document.getElementById("imageViewer");
const viewerImg     = document.getElementById("viewerImg");
const viewerClose   = document.getElementById("viewerClose");
const viewerCount   = document.getElementById("viewerCount");

let currentViewerShelfIndex = 0;
let currentViewerImageIndex = 0;

/* ==========================
   POPUP OPEN / CLOSE
========================== */
addBookBtn.addEventListener("click", () => {
  popup.classList.add("active");
  resetPopup();
  startCameraStream();
});

closePopupBtn.addEventListener("click", closePopup);

popup.addEventListener("click", (e) => {
  if (e.target === popup) {
    closePopup();
  }
});

function closePopup() {
  popup.classList.remove("active");
  stopCamera();
  resetPopup();
}

function resetPopup() {
  // show first step (camera)
  stepTakePhoto.classList.remove("hidden");
  stepShelf.classList.add("hidden");

  // reset camera + crop visibility
  cameraPreview.style.display = "block";
  cropContainer.classList.add("hidden");

  // destroy crop instance if any
  if (cropInstance) {
    cropInstance.destroy();
    cropInstance = null;
  }

  croppedBase64 = null;
  shelfInput.value = "";
}

/* ==========================
   CAMERA + CAPTURE + CROPPIE
========================== */
async function startCameraStream() {
  try {
    stopCamera(); // just in case

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    cameraPreview.srcObject = cameraStream;
    cameraPreview.play();
    cameraPreview.style.display = "block";
  } catch (err) {
    console.error("Camera error:", err);
    alert("Camera not available.");
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
}

/* Capture frame when user taps the video */
cameraPreview.addEventListener("click", async () => {
  if (!cameraPreview.videoWidth) {
    await new Promise(r => setTimeout(r, 200));
  }

  const canvas = document.createElement("canvas");
  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(cameraPreview, 0, 0, canvas.width, canvas.height);

  const photoData = canvas.toDataURL("image/jpeg", 1);

  stopCamera();

  cameraPreview.style.display = "none";
  cropContainer.classList.remove("hidden");

  if (cropInstance) {
    cropInstance.destroy();
  }

  cropInstance = new Croppie(cropImage, {
    viewport: { width: 250, height: 350 },
    boundary: { width: 280, height: 380 }
  });

  cropInstance.bind({ url: photoData });
});

/* Confirm crop → go to shelf step */
confirmCropBtn.addEventListener("click", async () => {
  if (!cropInstance) {
    alert("No image to crop yet. Tap the camera preview first.");
    return;
  }

  croppedBase64 = await cropInstance.result({
    type: "base64",
    size: "viewport",
    format: "jpeg",
    quality: 1
  });

  // Move to shelf step
  stepTakePhoto.classList.add("hidden");
  stepShelf.classList.remove("hidden");
});

/* ==========================
   SHELVES RENDERING
========================== */
function renderShelves() {
  shelvesList.innerHTML = "";

  shelves.forEach((shelf, shelfIndex) => {
    const count = shelf.books.length;

    const card = document.createElement("div");
    card.className = "shelf-card";
    card.dataset.shelfIndex = shelfIndex;

    card.innerHTML = `
      <div class="shelf-header">
        <h3>${shelf.name} (${count})</h3>
        <div class="shelf-actions">
          <span class="shelf-toggle">▶</span>
          <span class="shelf-delete">🗑️</span>
        </div>
      </div>
      <div class="shelf-books"></div>
    `;

    const booksContainer = card.querySelector(".shelf-books");

    shelf.books.forEach((book, idx) => {
      const bookDiv = document.createElement("div");
      bookDiv.className = "book-card";
      bookDiv.dataset.bookIndex = idx;
      bookDiv.innerHTML = `<img src="${book.src}" alt="card" />`;
      booksContainer.appendChild(bookDiv);
    });

    shelvesList.appendChild(card);
  });
}

/* ==========================
   ADD BOOK (SAVE CARD)
========================== */
saveBookBtn.addEventListener("click", () => {
  const rawName = shelfInput.value.trim();
  if (!rawName) {
    alert("Enter a shelf name.");
    return;
  }
  if (!croppedBase64) {
    alert("No image selected.");
    return;
  }

  const name = rawName.toLowerCase();

  let shelf = shelves.find(s => s.name === name);
  if (!shelf) {
    shelf = { name, books: [] };
    shelves.push(shelf);
  }

  shelf.books.push({
    id: Date.now(),
    src: croppedBase64
  });

  saveShelves();
  renderShelves();
  closePopup();
});

/* ==========================
   SHELF INTERACTIONS
   - toggle collapse
   - delete shelf
   - open viewer on image
========================== */
shelvesList.addEventListener("click", (e) => {
  const shelfCard = e.target.closest(".shelf-card");
  if (!shelfCard) return;

  const shelfIndex = Number(shelfCard.dataset.shelfIndex);
  const shelf = shelves[shelfIndex];

  // Delete shelf
  if (e.target.classList.contains("shelf-delete")) {
    const ok = confirm(`Delete shelf "${shelf.name}" and all its cards?`);
    if (!ok) return;

    shelves.splice(shelfIndex, 1);
    saveShelves();
    renderShelves();
    return;
  }

  // Toggle collapse
  if (e.target.classList.contains("shelf-toggle")) {
    shelfCard.classList.toggle("collapsed");
    return;
  }

  // Open viewer on image
  const bookCard = e.target.closest(".book-card");
  if (bookCard) {
    const bookIndex = Number(bookCard.dataset.bookIndex);
    openViewer(shelfIndex, bookIndex);
  }
});

/* ==========================
   IMAGE VIEWER
========================== */
function openViewer(shelfIndex, imageIndex) {
  currentViewerShelfIndex = shelfIndex;
  currentViewerImageIndex = imageIndex;

  const shelf = shelves[shelfIndex];
  const book = shelf.books[imageIndex];

  if (!book) return;

  viewerImg.src = book.src;
  viewerCount.textContent = `${imageIndex + 1} / ${shelf.books.length}`;

  imageViewer.classList.add("active");
}

viewerClose.addEventListener("click", () => {
  imageViewer.classList.remove("active");
});

imageViewer.addEventListener("click", (e) => {
  if (e.target === imageViewer) {
    imageViewer.classList.remove("active");
  }
});