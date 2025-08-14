import { toPng, toJpeg, toSvg } from 'html-to-image';
import { getRectOfNodes, getTransformForBounds } from 'reactflow';
import { Node } from 'reactflow';

export type ImageFormat = 'png' | 'jpeg' | 'svg';

const imageWidth = 1024;
const imageHeight = 768;

export function downloadImage(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.setAttribute('download', filename);
  a.setAttribute('href', dataUrl);
  a.click();
}

export function getImageExportFilename(familyName: string, format: ImageFormat): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${familyName.replace(/\s+/g, '-').toLowerCase()}-family-tree-${timestamp}.${format}`;
}

export async function exportFamilyTreeAsImage(
  nodes: Node[],
  format: ImageFormat = 'png',
  familyName: string = 'family-tree'
): Promise<string> {
  const nodesBounds = getRectOfNodes(nodes);
  const transform = getTransformForBounds(nodesBounds, imageWidth, imageHeight, 0.5, 2);
  
  const viewport = document.querySelector('.react-flow__viewport') as HTMLElement;
  
  if (!viewport) {
    throw new Error('Could not find React Flow viewport');
  }

  // Create export options
  const exportOptions = {
    backgroundColor: '#ffffff',
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${transform[0]}px, ${transform[1]}px) scale(${transform[2]})`,
    },
    filter: (node: Element) => {
      // Exclude controls and other UI elements, only include nodes and edges
      if (node?.classList?.contains('react-flow__controls')) return false;
      if (node?.classList?.contains('react-flow__minimap')) return false;
      if (node?.classList?.contains('react-flow__attribution')) return false;
      return true;
    },
  };

  let dataUrl: string;
  
  switch (format) {
    case 'jpeg':
      dataUrl = await toJpeg(viewport, {
        ...exportOptions,
        quality: 0.9,
      });
      break;
    case 'svg':
      dataUrl = await toSvg(viewport, exportOptions);
      break;
    case 'png':
    default:
      dataUrl = await toPng(viewport, exportOptions);
      break;
  }

  return dataUrl;
}