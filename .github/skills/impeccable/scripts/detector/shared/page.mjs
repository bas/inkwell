/** Check if content looks like a full page (not a component/partial) */
function stripHtmlComments(content) {
  let stripped = '';
  let index = 0;

  while (index < content.length) {
    const start = content.indexOf('<!--', index);
    if (start === -1) {
      stripped += content.slice(index);
      break;
    }

    stripped += content.slice(index, start);
    const end = content.indexOf('-->', start + 4);
    if (end === -1) break;
    index = end + 3;
  }

  return stripped;
}

function isFullPage(content) {
  const stripped = stripHtmlComments(content);
  return /<!doctype\s|<html[\s>]|<head[\s>]/i.test(stripped);
}

export { isFullPage };
