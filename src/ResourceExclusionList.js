const blacklist = [
  "//fonts.googleapis.com",
  "//cdn.jsdelivr.net",
  "//cdnjs.cloudflare.com",
  "//ajax.googleapis.com",
  "//use.typekit.net",
  ".amazonaws.com",
  ".gstatic.com",
];

export const isBlacklisted = function (url) {
  if (!url) {
    return false;
  }

  for (var i = 0; i < blacklist.length; i++) {
    if (url.indexOf(blacklist[i]) !== -1) {
      return true;
    }
  }
  return false;
};
