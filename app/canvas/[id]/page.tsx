// app/canvas/[id]/page.tsx
"use client";

import { useParams, useRouter } from 'next/navigation';
import MultiCanvas from '../../components/Multicanvas';
import { useEffect } from 'react'; // Import Link from next/link

const CanvasPage = () => {
  const router = useRouter();
  const params = useParams(); // Get the route parameters using useParams
  const id = params?.id; // Extract the 'id' parameter

  useEffect(() => {
    if (!id) {
      router.push('/'); // Redirect to homepage if no ID is provided
    }
  }, [id]);

  if (!id) return null; // Wait for ID to load

  return (
    <div className='flex flex-col'>
      
      <MultiCanvas canvasRoomId={id as string} />
    </div>
  );
};

export default CanvasPage;
