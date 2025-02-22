// app/canvas/[id]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import MultiCanvas from '../../components/Multicanvas';

const CanvasPage = () => {

  const params = useParams(); // Get the route parameters using useParams
  const id = params?.id; // Extract the 'id' parameter

  if (!id) return null; // Wait for ID to load
  return (
    <div className='flex flex-col'>
      <MultiCanvas canvasRoomId={id as string} />
    </div>
  );
};

export default CanvasPage;
