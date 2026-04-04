export const blobToText = async (blob) => {
  try {
    return await new Response(blob).text();
  } catch {
    return '';
  }
};

export const extractAxiosBlobErrorMessage = async (err, fallback) => {
  const status = err?.response?.status;
  const data = err?.response?.data;
  if (data instanceof Blob) {
    const text = await blobToText(data);
    try {
      const parsed = JSON.parse(text);
      return parsed?.msg || parsed?.message || fallback || `Export failed (HTTP ${status || '?'})`;
    } catch {
      return text?.slice(0, 220) || fallback || `Export failed (HTTP ${status || '?'})`;
    }
  }
  return err?.response?.data?.msg || err?.response?.data?.message || err?.message || fallback || `Export failed (HTTP ${status || '?'})`;
};

export const downloadBlobSmart = async (blob, filename, mimeType) => {
  // WebView note: Web Share API may exist but fail; always fallback to direct download/open.
  try {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        return;
      } catch {
        // User cancelled or WebView blocked sharing; continue to fallback.
      }
    }
  } catch {
    // File constructor can fail in some WebViews; continue.
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener');
  document.body.appendChild(link);

  // Some WebViews ignore `download`; opening a new tab helps.
  try {
    link.click();
  } catch {
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // ignore
    }
  } finally {
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(url), 2500);
  }
};

