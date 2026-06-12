const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}
function addToCart(name, price) {
  const cart = JSON.parse(localStorage.getItem("cart") || "[]");

  cart.push({
    name: name,
    price: price,
    quantity: 1
  });

  localStorage.setItem("cart", JSON.stringify(cart));

  alert(name + " added to cart");
}
