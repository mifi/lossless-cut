export default function fileUri(filePath: string, isWindows: boolean) {
  let pathName = filePath;

  if (isWindows) {
    pathName = pathName.replaceAll('\\', '/');
  }

  // Windows drive letter must be prefixed with a slash.
  // also relative paths will be converted to absolute
  if (pathName[0] !== '/') {
    pathName = `/${pathName}`;
  }

  // Escape required characters for path components.
  // See: https://tools.ietf.org/html/rfc3986#section-3.3
  return encodeURI(`file://${pathName}`).replaceAll(/[#?]/g, encodeURIComponent);
}
