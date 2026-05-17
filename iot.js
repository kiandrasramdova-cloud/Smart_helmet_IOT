const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const packages = {
  full: {
    tag: "Produk utama",
    name: "Smart Helmet Prototype",
    price: 600000,
    image: "assets/smart-helmet-logo.png",
    description: "Helm pintar dengan IMU, GPS, DHT11, MQ-2, ESP32, dan LoRa.",
  },
  service: {
    tag: "Produk plus",
    name: "Smart Helmet Prototype+",
    price: 1000000,
    image: "assets/smart-helmet-logo.png",
    description: "Helm pintar dengan IMU, GPS, DHT11, MQ-2, ESP32, dan LoRa. Paket ini ditambah tutorial pemakaian dan jasa penghubungan ke dashboard pemantau perusahaan.",
  },
};

const shippingCosts = {
  java: 35000,
  outside: 75000,
};

const cart = {};
const wishlist = new Set();
let activePackageKey = "full";
let qrisTimer = null;
let qrisCountdown = 5;
let pendingTotal = 0;

const packageModal = document.querySelector("#packageModal");
const cartModal = document.querySelector("#cartModal");
const wishlistModal = document.querySelector("#wishlistModal");
const qrisModal = document.querySelector("#qrisModal");
const modalImage = document.querySelector("#modalImage");
const modalTag = document.querySelector("#modalTag");
const modalTitle = document.querySelector("#modalTitle");
const modalDescription = document.querySelector("#modalDescription");
const modalPrice = document.querySelector("#modalPrice");
const modalQuantity = document.querySelector("#modalQuantity");
const shippingRegion = document.querySelector("#shippingRegion");
const cartModalList = document.querySelector("#cartModalList");
const wishlistModalList = document.querySelector("#wishlistModalList");
const wishlistPopover = document.querySelector("#wishlistPopover");
const wishlistPopoverList = document.querySelector("#wishlistPopoverList");
const cartModalTotal = document.querySelector("#cartModalTotal");
const qrisTotal = document.querySelector("#qrisTotal");
const qrisImage = document.querySelector("#qrisImage");
const qrisMissing = document.querySelector("#qrisMissing");
const confirmPaymentButton = document.querySelector("[data-confirm-payment]");
const cartCount = document.querySelector("[data-cart-count]");
const wishlistCount = document.querySelector("[data-wishlist-count]");

function getPackage(key) {
  return packages[key];
}

function getCartSubtotal() {
  return Object.entries(cart).reduce((sum, [key, quantity]) => {
    return sum + getPackage(key).price * quantity;
  }, 0);
}

function getCartCount() {
  return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
}

function getShippingCost(region = shippingRegion.value) {
  return shippingCosts[region] || 0;
}

function getCartTotal() {
  return getCartSubtotal() + (getCartCount() > 0 ? getShippingCost() : 0);
}

function openModal(modal) {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeModals() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  });
  document.body.classList.remove("modal-open");
}

function openPackageModal(key) {
  const item = getPackage(key);
  activePackageKey = key;
  modalImage.src = item.image;
  modalImage.alt = `Foto ${item.name}`;
  modalTag.textContent = item.tag;
  modalTitle.textContent = item.name;
  modalDescription.textContent = item.description;
  modalPrice.textContent = rupiah.format(item.price);
  modalQuantity.value = cart[key] || 1;
  openModal(packageModal);
}

function addOrUpdateCart(key, quantity = 1) {
  cart[key] = Math.max(cart[key] || 0, quantity);
  updateUI();
}

function changeCartQuantity(key, change) {
  const nextQuantity = (cart[key] || 0) + change;

  if (nextQuantity <= 0) {
    removeFromCart(key);
    return;
  }

  cart[key] = nextQuantity;
  updateUI();
}

function removeFromCart(key) {
  delete cart[key];
  updateUI();
}

function setWishlist(key, forceValue) {
  const shouldAdd = typeof forceValue === "boolean" ? forceValue : !wishlist.has(key);

  if (shouldAdd) {
    wishlist.add(key);
  } else {
    wishlist.delete(key);
  }

  updateUI();
}

function removeFromWishlist(key) {
  wishlist.delete(key);
  updateUI();
}

function flashButton(button, text) {
  const original = button.innerHTML;
  button.classList.remove("feedback");
  void button.offsetWidth;
  button.classList.add("feedback");
  button.textContent = text;

  window.setTimeout(() => {
    button.innerHTML = original;
  }, 900);
}

function renderList(target, entries, withQuantity) {
  if (!entries.length) {
    target.innerHTML = '<div class="mini-empty">Belum ada paket.</div>';
    return;
  }

  target.innerHTML = entries.map(([key, quantity]) => {
    const item = getPackage(key);
    const qtyText = withQuantity ? `<p>${quantity} paket</p>` : "<p>Tersimpan</p>";
    const price = withQuantity ? item.price * quantity : item.price;
    const removeAttr = withQuantity ? `data-remove-cart="${key}"` : `data-remove-wishlist="${key}"`;
    const qtyControl = withQuantity
      ? `
        <div class="cart-qty" aria-label="Atur kuantitas ${item.name}">
          <button type="button" data-cart-dec="${key}" aria-label="Kurangi ${item.name}">-</button>
          <span>${quantity}</span>
          <button type="button" data-cart-inc="${key}" aria-label="Tambah ${item.name}">+</button>
        </div>
      `
      : "";

    return `
      <article class="mini-item">
        <div class="mini-thumb"><img src="${item.image}" alt=""></div>
        <div>
          <h4>${item.name}</h4>
          ${qtyText}
        </div>
        ${qtyControl}
        <strong>${rupiah.format(price)}</strong>
        <button class="mini-remove" type="button" aria-label="Hapus ${item.name}" ${removeAttr}>Hapus</button>
      </article>
    `;
  }).join("");
}

function updateCardStates() {
  document.querySelectorAll("[data-wishlist-package]").forEach((button) => {
    const isActive = wishlist.has(button.dataset.wishlistPackage);
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function updateUI() {
  const total = getCartTotal();
  const cartEntries = Object.entries(cart);
  const wishlistEntries = Array.from(wishlist).map((key) => [key, 1]);
  const hasItems = getCartCount() > 0;

  cartCount.textContent = getCartCount();
  wishlistCount.textContent = wishlist.size;
  cartModalTotal.textContent = rupiah.format(total);
  shippingRegion.disabled = !hasItems;

  renderList(cartModalList, cartEntries, true);
  renderList(wishlistModalList, wishlistEntries, false);
  renderList(wishlistPopoverList, wishlistEntries, false);
  updateCardStates();
}

function startQrisPayment(total) {
  pendingTotal = total;
  qrisCountdown = 5;
  qrisTotal.textContent = rupiah.format(pendingTotal);
  confirmPaymentButton.disabled = true;
  confirmPaymentButton.textContent = `Konfirmasi Pembayaran (${qrisCountdown})`;
  closeModals();
  openModal(qrisModal);

  window.clearInterval(qrisTimer);
  qrisTimer = window.setInterval(() => {
    qrisCountdown -= 1;
    confirmPaymentButton.textContent = `Konfirmasi Pembayaran (${qrisCountdown})`;

    if (qrisCountdown <= 0) {
      window.clearInterval(qrisTimer);
      confirmPaymentButton.disabled = false;
      confirmPaymentButton.textContent = "Konfirmasi Pembayaran";
    }
  }, 1000);
}

function checkoutPackage() {
  const quantity = Number(modalQuantity.value) || 1;
  addOrUpdateCart(activePackageKey, quantity);
  closeModals();
  openModal(cartModal);
}

function checkoutCart() {
  if (getCartCount() === 0) {
    alert("Keranjang masih kosong. Pilih paket terlebih dahulu.");
    return;
  }

  startQrisPayment(getCartTotal());
}

document.querySelectorAll("[data-open-package]").forEach((button) => {
  button.addEventListener("click", () => openPackageModal(button.dataset.openPackage));
});

document.querySelectorAll("[data-package-card]").forEach((card) => {
  card.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    openPackageModal(card.dataset.packageCard);
  });
});

document.querySelectorAll("[data-cart-package]").forEach((button) => {
  button.addEventListener("click", () => {
    addOrUpdateCart(button.dataset.cartPackage, 1);
    flashButton(button, "Tertambah");
  });
});

document.querySelectorAll("[data-wishlist-package]").forEach((button) => {
  button.addEventListener("click", () => {
    setWishlist(button.dataset.wishlistPackage);
    flashButton(button, wishlist.has(button.dataset.wishlistPackage) ? "OK" : "Hapus");
  });
});

document.querySelector("[data-open-cart]").addEventListener("click", () => {
  updateUI();
  openModal(cartModal);
});

document.querySelector("[data-open-wishlist]").addEventListener("click", (event) => {
  event.stopPropagation();
  updateUI();
  wishlistPopover.classList.toggle("is-open");
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeModals);
});

document.querySelectorAll("[data-modal-qty]").forEach((button) => {
  button.addEventListener("click", () => {
    const current = Number(modalQuantity.value) || 1;
    modalQuantity.value = button.dataset.modalQty === "plus" ? current + 1 : Math.max(1, current - 1);
  });
});

modalQuantity.addEventListener("input", () => {
  modalQuantity.value = Math.max(1, Number(modalQuantity.value) || 1);
});

document.querySelector("[data-modal-cart]").addEventListener("click", (event) => {
  addOrUpdateCart(activePackageKey, Number(modalQuantity.value) || 1);
  flashButton(event.currentTarget, "Tertambah");
});

document.querySelector("[data-modal-wishlist]").addEventListener("click", (event) => {
  setWishlist(activePackageKey, true);
  flashButton(event.currentTarget, "Tersimpan");
});

document.querySelector("[data-modal-buy]").addEventListener("click", checkoutPackage);
document.querySelector("[data-checkout-all]").addEventListener("click", checkoutCart);

confirmPaymentButton.addEventListener("click", () => {
  if (confirmPaymentButton.disabled) return;
  alert("Pembayaran dikonfirmasi. Simpan bukti transfer QRIS untuk verifikasi.");
  closeModals();
});

qrisImage.addEventListener("error", () => {
  qrisImage.classList.add("is-missing");
  qrisMissing.classList.add("is-visible");
});

shippingRegion.addEventListener("change", updateUI);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".wishlist-popover") && !event.target.closest("[data-open-wishlist]")) {
    wishlistPopover.classList.remove("is-open");
  }

  const removeCartButton = event.target.closest("[data-remove-cart]");
  const removeWishlistButton = event.target.closest("[data-remove-wishlist]");

  if (removeCartButton) {
    removeFromCart(removeCartButton.dataset.removeCart);
  }

  if (removeWishlistButton) {
    removeFromWishlist(removeWishlistButton.dataset.removeWishlist);
  }

  const cartDecButton = event.target.closest("[data-cart-dec]");
  const cartIncButton = event.target.closest("[data-cart-inc]");

  if (cartDecButton) {
    changeCartQuantity(cartDecButton.dataset.cartDec, -1);
  }

  if (cartIncButton) {
    changeCartQuantity(cartIncButton.dataset.cartInc, 1);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModals();
  }
});

updateUI();
