const pdfInput = document.getElementById('pdfInput');
const uploadArea = document.getElementById('uploadArea');
const fileList = document.getElementById('fileList');
const mergeBtn = document.getElementById('mergeBtn');
const status = document.getElementById('status');

let selectedFiles = [];

uploadArea.addEventListener('click', (e) => {
  if (e.target !== pdfInput) {
    pdfInput.click();
  }
});

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.style.background = '#ede9fe';
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.style.background = '';
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.style.background = '';
  const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
  addFiles(files);
});

pdfInput.addEventListener('change', () => {
  addFiles(Array.from(pdfInput.files));
});

function addFiles(files) {
  files.forEach(file => {
    if (!selectedFiles.find(f => f.name === file.name)) {
      selectedFiles.push(file);
    }
  });
  renderFileList();
}

function renderFileList() {
  fileList.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const li = document.createElement('li');
    li.textContent = file.name;

    const remove = document.createElement('span');
    remove.textContent = '✕';
    remove.style.cssText = 'margin-left:auto; cursor:pointer; color:#7c3aed; font-weight:bold;';
    remove.onclick = () => {
      selectedFiles.splice(index, 1);
      renderFileList();
    };

    li.appendChild(remove);
    fileList.appendChild(li);
  });

  mergeBtn.disabled = selectedFiles.length < 2;
  status.textContent = '';
}

mergeBtn.addEventListener('click', async () => {
  status.style.color = '#555';
  status.textContent = '⏳ Merging, please wait...';
  mergeBtn.disabled = true;

  try {
    const mergedPdf = await PDFLib.PDFDocument.create();

    for (const file of selectedFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    const mergedBytes = await mergedPdf.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'merged.pdf';
    a.click();
    URL.revokeObjectURL(url);

    status.style.color = 'green';
    status.textContent = '✅ Merged successfully! Download started.';
  } catch (err) {
    status.style.color = 'red';
    status.textContent = '❌ Error: ' + err.message;
  }

  mergeBtn.disabled = selectedFiles.length < 2;
});