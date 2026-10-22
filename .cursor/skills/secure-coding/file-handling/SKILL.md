---
name: file-handling
description: >-
  Secure file upload, storage, and download: magic-byte validation, size caps,
  archive bomb protection, path traversal prevention, and safe download headers.
  Use when touching file upload endpoints, multipart form handling, file storage
  paths, archive extraction, image processing, or file download/serve endpoints.
  Controls FILE-1 ... FILE-4.
pillar: secure-coding
controls: [FILE-1, FILE-2, FILE-3, FILE-4]
level-default: L2
source:
  - docs/shipyard/ai-cys-dev-poc/secure-coding-context.md#5-file-handling
---

# File Handling

**Objective:** Prevent malicious file uploads from reaching execution, storage
outside the intended root, or being served back in dangerous ways. Validate
content by magic bytes, enforce size limits, randomise storage names, and
prevent path traversal.

## When this applies

Activate this skill when touching: file upload endpoints (`MultipartFile`,
`multer`, `multipart/form-data`), archive extraction (ZIP, TAR, GZIP), image
processing pipelines, file storage path construction, file download or serve
endpoints, or any code that reads a filename from user input.

## Controls

Apply every control at or below the application's target level (`L1 ⊆ L2 ⊆ L3`).

| Ctrl | Level | Requirement | Acceptance criterion |
|------|-------|-------------|----------------------|
| FILE-1 | L2 | Document allowed file types, expected extensions, maximum file sizes; document response to malicious files. | File handling policy documented; allowed types and size caps defined and enforced consistently. |
| FILE-2 | L1 | Validate by **magic bytes** (not extension); enforce size cap; for archives: cap entry count, total uncompressed size, and compression ratio; reject symlinks in archives unless explicitly controlled; block images with excessive pixel dimensions. | Upload rejected if magic bytes do not match declared type; size cap enforced before processing; archive bombs rejected; no symlinks extracted. |
| FILE-3 | L2 | Store uploaded files outside the web root as non-executable static content; use internally generated random filenames; ignore user-provided path information; normalize and verify paths stay within the upload root. | No uploaded file reachable via direct URL without explicit serve endpoint; storage path does not include any user-supplied segment; path traversal payloads rejected. |
| FILE-4 | L2 | Validate or ignore user-supplied filenames; set `Content-Disposition: attachment` with a safe filename; encode filenames per RFC 6266; scan files from untrusted sources with antivirus before serving. | All downloads served with `Content-Disposition: attachment`; user-supplied filename sanitised or replaced; AV scan gate in place for untrusted content. |

## Safe primitives

| Concern | Java | Python | Node.js |
|---------|------|--------|---------|
| Magic byte check | `Apache Tika` (`Tika.detect(inputStream)`) | `python-magic` | `file-type` |
| Random filename | `UUID.randomUUID().toString()` | `uuid.uuid4()` | `crypto.randomUUID()` |
| Path normalisation | `Path.of(root).resolve(name).normalize().startsWith(root)` | `pathlib.Path(root, name).resolve().is_relative_to(root)` | `path.resolve(root, name).startsWith(root)` |
| Archive size cap | Custom extraction loop with entry count + size tracking | `zipfile` with manual size tracking | `yauzl` with size tracking |

## Secure vs insecure patterns

**Insecure (flag and fix):**

```java
// FILE-2: extension-only validation — trivially bypassed
String ext = filename.substring(filename.lastIndexOf('.'));
if (!ext.equals(".jpg")) throw new Exception("Invalid");   // attacker uses shell.jpg.php

// FILE-3: path traversal via user-supplied filename
Path target = Paths.get(uploadDir, file.getOriginalFilename());   // ../../etc/passwd
Files.write(target, file.getBytes());

// FILE-3: file stored in web root — directly accessible via URL
String storagePath = "src/main/resources/static/uploads/" + filename;

// FILE-4: user-supplied filename in Content-Disposition
response.setHeader("Content-Disposition", "attachment; filename=" + userFilename);
```

**Secure (apply instead):**

```java
// FILE-2: magic byte validation with Apache Tika
Tika tika = new Tika();
String detectedType = tika.detect(file.getInputStream());
if (!ALLOWED_TYPES.contains(detectedType)) {
    throw new IllegalArgumentException("File type not allowed: " + detectedType);
}
if (file.getSize() > MAX_SIZE_BYTES) {
    throw new IllegalArgumentException("File exceeds size limit");
}

// FILE-3: random filename, path normalisation, outside web root
String safeFilename = UUID.randomUUID() + ".bin";   // no user input in name
Path uploadRoot = Paths.get(uploadDir).toRealPath();
Path target = uploadRoot.resolve(safeFilename).normalize();
if (!target.startsWith(uploadRoot)) throw new SecurityException("Path traversal detected");
Files.write(target, file.getBytes());

// FILE-4: safe Content-Disposition with sanitised filename
String safeDisplay = file.getOriginalFilename()
    .replaceAll("[^a-zA-Z0-9._-]", "_")   // allowlist characters
    .substring(0, Math.min(64, name.length()));
response.setHeader("Content-Disposition",
    ContentDisposition.attachment().filename(safeDisplay, StandardCharsets.UTF_8).build().toString());
```

## Review checklist

- [ ] File type validated by magic bytes — not extension alone (FILE-2)
- [ ] File size cap enforced before processing (FILE-2)
- [ ] Archive extraction caps entry count, total uncompressed size, and compression ratio (FILE-2)
- [ ] No symlinks extracted from archives without explicit control (FILE-2)
- [ ] Uploaded files stored outside the web root (FILE-3)
- [ ] Storage filename is internally generated (UUID/random) — no user input (FILE-3)
- [ ] Storage path normalised and verified to stay within upload root (FILE-3)
- [ ] All downloads served with `Content-Disposition: attachment` (FILE-4)
- [ ] User-supplied filename sanitised or replaced in `Content-Disposition` (FILE-4)

## When a control cannot be met

Document the deviation explicitly as an exception with rationale and a follow-up.
Never silently bypass a control.

## Source & drift audit

Distilled from:
- `docs/shipyard/ai-cys-dev-poc/secure-coding-context.md` — section 5 (File Handling, FILE-1 ... FILE-4)

Control IDs above are the audit anchors. If the source guideline changes, re-run the
distillation pipeline and reconcile this table; do not hand-drift control text.
