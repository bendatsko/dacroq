const fs = require('fs');
const path = require('path');
const os = require('os');

// Directories to preserve
const preserveDirs = [];
const replaceClass = [
  '!absolute',
  '!bg-transparent',
  '!bg-white',
  '!divide-y-0',
  '!font-normal',
  '!tabular-nums',
  '!flex-1',
  '!flex',
  '!flex-wrap',
  '!block',
  '!bg-[#090E1A]',
  '!bg-red-50',
  '!bg-gray-50',
  '!bg-gray-200',
  '!bg-gray-100',
  '!bg-gray-900',
  '!border-gray-200',
  '!border-gray-800',
  '!border-gray-900',
  '!gap-1.5',
  '!gap-px',
  '!gap-2',
  '!gap-3',
  '!grid-cols-2',
  '!grid-cols-4',
  '!h-10',
  '!h-20',
  '!h-24',
  '!h-32',
  '!h-36',
  '!h-44',
  '!h-48',
  '!h-56',
  '!h-60',
  '!h-72',
  '!h-80',
  '!h-96',
  '!justify-start',
  '!mx-auto',
  '!my-0',
  '!my-3',
  '!my-4',
  '!my-5',
  '!my-6',
  '!my-10',
  '!my-12',
  '!my-14',
  '!overflow-visible',
  '!overflow-hidden',
  '!pb-4',
  '!pt-2',
  '!p-0',
  '!p-1',
  '!p-2',
  '!p-4',
  '!py-0.5',
  '!py-1.5',
  '!py-2',
  '!py-2.5',
  '!py-3',
  '!py-4',
  '!rounded-tremor-small',
  '!border-transparent',
  '!px-0',
  '!px-0.5',
  '!px-1.5',
  '!px-2.5',
  '!px-3',
  '!px-4',
  '!px-6',
  '!px-8',
  '!px-10',
  '!py-4',
  '!py-6',
  '!pl-5',
  '!pr-12',
  '!rounded-full',
  '!right-3',
  '!space-x-4',
  '!space-x-2',
  '!shadow-none',
  '!shrink-0',
  '!top-3',
  '!text-left',
  '!text-xs',
  '!text-gray-300',
  '!text-gray-500',
  '!text-gray-700',
  '!text-red-500',
  '!text-blue-500',
  '!text-blue-600',
  '!w-1/3',
  '!w-2/3',
  '!w-20',
  '!w-32',
  '!w-36',
  '!w-fit',
];

function wrapContentWithCodeBlock(content) {
  return '````tsx\n' + content + '\n````';
}

function deleteDirectoryRecursive(directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file) => {
      const currentPath = path.join(directoryPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        deleteDirectoryRecursive(currentPath);
      } else {
        fs.unlinkSync(currentPath);
      }
    });
    fs.rmdirSync(directoryPath);
  }
}

function replaceDivs(content) {
  let replacedObfuscateDiv = false;

  // Replace the first occurrence of <div className="obfuscate"> with <>
  if (content.includes('<div className="obfuscate">')) {
    content = content.replace('<div className="obfuscate">', '<>');
    replacedObfuscateDiv = true;
  }

  // Find and replace the last occurrence of </div> with </> only if <div className="obfuscate"> was replaced
  if (replacedObfuscateDiv) {
    const lastIndex = content.lastIndexOf('</div>');
    if (lastIndex !== -1) {
      content =
        content.substring(0, lastIndex) +
        '</>' +
        content.substring(lastIndex + '</div>'.length);
    }
  }

  // Replace strings defined in the replaceClass array
  replaceClass.forEach((cls) => {
    const regex = new RegExp(cls, 'g'); // Global flag to replace all occurrences
    content = content.replace(regex, cls.substring(1)); // Remove the exclamation mark
  });

  // Comment out any 'use client'; directives
  content = content.replace(/'use client';/g, "// 'use client';");

  return content;
}

function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  let entries = fs.readdirSync(src, { withFileTypes: true });

  for (let entry of entries) {
    if (entry.name === 'index.ts') {
      continue;
    }

    let srcPath = path.join(src, entry.name);
    let destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      let content = fs.readFileSync(srcPath, 'utf8');
      content = replaceDivs(content);

      if (path.extname(entry.name) === '.tsx') {
        destPath = path.join(dest, path.basename(entry.name, '.tsx') + '.mdx');
        let newContent = wrapContentWithCodeBlock(content);
        fs.writeFileSync(destPath, newContent);
      } else {
        fs.writeFileSync(destPath, content);
      }
    }
  }
}

// Rest of your existing code for args, folderPath, etc.

const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node script.js <folderPath>');
  process.exit(1);
}

const folderPath = args[0];
const parentDir = path.dirname(folderPath);
const newFolderPath = path.join(parentDir, 'markdown');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-'));

// Copy preserved directories to the temporary location
preserveDirs.forEach((dir) => {
  const src = path.join(newFolderPath, dir);
  const dest = path.join(tempDir, dir);
  if (fs.existsSync(src)) {
    copyDirectory(src, dest);
  }
});

// Delete existing 'markdown' directory
deleteDirectoryRecursive(newFolderPath);

// Create new markdown content from the components directory, excluding preserved directories
copyDirectory(folderPath, newFolderPath);

// Clean up the temporary directory
fs.rm(tempDir, { recursive: true, force: true }, (err) => {
  if (err) {
    console.error(`Error cleaning up temporary directory: ${err}`);
  }
});

console.log(
  `Folder duplicated and markdown created successfully: ${newFolderPath}`,
);
