const mems = [{ member_id: "DD-001", name: "John", photo: "base64" }];
const idx = 0;
const ex = mems[idx];
mems[idx] = {
  ...ex,
  name: "John Updated",
  mobile: ""
};
console.log(mems[idx]);
