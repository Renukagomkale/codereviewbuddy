var total = 0;

function addAll(values) {
  if (values.length == 0) return 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i];
  }
  console.log("total", total);
  return total;
}

try {
  addAll([1, 2, 3]);
} catch (e) {}
