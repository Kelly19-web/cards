/* -------------------------
   GLOBAL MEMORY (localStorage)
------------------------- */
let libraryData = {};

/* Load saved data on page open */
window.onload = () => {
  const saved = localStorage.getItem("libraryData");
  if (saved) {
    libraryData = JSON.parse(saved);
    renderShelvesFromMemory();
  }
};

/* Save to localStorage */
function saveToLocalStorage() {
  localStorage.setItem("libraryData", JSON.stringify(libraryData));
}

/* -------------------------
   POPUP
------------------------- */
const addBookBtn = document.getElementById("addBookBtn");
const popup = document.getElementById("addBookModal");
const closePopupBtn = document.getElementById("closePopupBtn");

addBookBtn.onclick = () => {
  popup.classList.add("active");
  startCameraStream();
};

closePopupBtn.onclick = () => closePopup();
popup.onclick = (e) => { if (e.target === popup) closePopup(); };

function closePopup() {
  popup.classList.remove("active");
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  resetPopup();
}

function resetPopup() {
  document.getElementById("stepTakePhoto").classList.remove("hidden");
  document.getElementById("stepShelf").classList.add("hidden");
  cropContainer.style.display = "none";
  cameraPreview.style.display = "block";
  croppedBase64 = null;
  document.getElementById("shelfInput").value = "";
}

/* -------------------------
   CAMERA
------------------------- */
const cameraPreview = document.getElementById("cameraPreview");
const startCameraBtn = document.getElementById("startCameraBtn");
let cameraStream = null;

async function startCameraStream() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    cameraPreview.srcObject = cameraStream;
    cameraPreview.style.display = "block";
  } catch (err) {
    alert("Camera not available");
  }
}

/* -------------------------
   CROPPIE SETUP
------------------------- */
const cropContainer = document.getElementById("cropContainer");
const cropImage = document.getElementById("cropImage");
const confirmCropBtn = document.getElementById("confirmCropBtn");

let cropInstance = null;
let croppedBase64 = null;

startCameraBtn.addEventListener("click", async () => {
  if (!cameraPreview.videoWidth) await new Promise(r => setTimeout(r, 300));

  const canvas = document.createElement("canvas");
  canvas.width = cameraPreview.videoWidth;
  canvas.height = cameraPreview.videoHeight;
  canvas.getContext("2d").drawImage(cameraPreview, 0, 0);

  const photoData = canvas.toDataURL("image/jpeg", 1);

  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }

  cameraPreview.style.display = "none";
  cropContainer.style.display = "block";

  if (cropInstance) cropInstance.destroy();

  cropInstance = new Croppie(cropImage, {
    viewport: { width: 250, height: 350 },
    boundary: { width: 280, height: 380 }
  });

  cropInstance.bind({ url: photoData });
});

confirmCropBtn.addEventListener("click", () => {
  cropInstance.result({
    type: "base64",
    size: "viewport",
    format: "jpeg",
    quality: 1
  }).then(img => {
    croppedBase64 = img;

    cropContainer.style.display = "none";
    document.getElementById("stepTakePhoto").classList.add("hidden");
    document.getElementById("stepShelf").classList.remove("hidden");
  });
});

/* -------------------------
   SHELF CREATION + DROPDOWN + DELETE
------------------------- */
const shelves = ["read", "wishlist", "havent"];

function ensureShelfExists(name) {
  const lower = name.toLowerCase();
  const container = document.querySelector(".shelves-list");

  // Already exists?
  if (document.getElementById(`shelf-${lower}`)) {
    return lower;
  }

  // MEMORY: create shelf entry if missing
  if (!libraryData[lower]) {
    libraryData[lower] = [];
    saveToLocalStorage();
  }

  // CREATE SHELF HTML
  container.innerHTML += `
    <div class="shelf-card" id="shelf-${lower}">
      <div class="shelf-header">
        <h3>
          <span class="shelf-name">${lower}</span>
          <span class="shelf-count">(0)</span>
        </h3>

        <div class="shelf-actions">
          <span class="shelf-toggle">▶</span>
          <span class="shelf-delete">🗑️</span>
        </div>
      </div>

      <div class="shelf-books" id="shelf-${lower}-books"></div>
    </div>
  `;

  // SELECT ELEMENTS
  const shelfCard = document.getElementById(`shelf-${lower}`);
  const toggleBtn = shelfCard.querySelector(".shelf-toggle");
  const deleteBtn = shelfCard.querySelector(".shelf-delete");

  // COLLAPSE TOGGLE
  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    shelfCard.classList.toggle("collapsed");
    toggleBtn.style.transform = shelfCard.classList.contains("collapsed")
      ? "rotate(-90deg)"
      : "rotate(0deg)";
  });

  // DELETE SHELF
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    const confirmDelete = confirm(`Delete shelf "${lower}" and all its books?`);
    if (!confirmDelete) return;

    shelfCard.remove();
    delete libraryData[lower];
    saveToLocalStorage();
  });

  return lower;
}

/* -------------------------
   ADD BOOK TO SHELF
------------------------- */
function addBookToShelf(shelf, cover) {
  const box = document.getElementById(`shelf-${shelf}-books`);
  box.innerHTML += `
    <div class="book-card">
      <img src="${cover}">
    </div>
  `;

  // MEMORY: save image
  libraryData[shelf].push(cover);
  saveToLocalStorage();

  updateShelfCount(shelf);
}

/* -------------------------
   UPDATE COUNTERS
------------------------- */
function updateShelfCount(shelf) {
  const count = libraryData[shelf]?.length || 0;
  const counter = document.querySelector(`#shelf-${shelf} .shelf-count`);
  if (counter) counter.textContent = `(${count})`;
}

/* -------------------------
   RENDER SAVED SHELVES
------------------------- */
function renderShelvesFromMemory() {
  for (const shelf in libraryData) {
    ensureShelfExists(shelf);

    const books = libraryData[shelf];
    books.forEach(cover => {
      const box = document.getElementById(`shelf-${shelf}-books`);
      box.innerHTML += `
        <div class="book-card">
          <img src="${cover}">
        </div>
      `;
    });

    updateShelfCount(shelf);
  }
}

/* -------------------------
   SAVE BOOK BUTTON
------------------------- */
document.getElementById("saveBookBtn").addEventListener("click", () => {
  const shelfName = document.getElementById("shelfInput").value.trim();
  if (!shelfName) return alert("Enter shelf name");
  if (!croppedBase64) return alert("Image missing");

  const finalShelf = ensureShelfExists(shelfName);
  addBookToShelf(finalShelf, croppedBase64);

  closePopup();
});