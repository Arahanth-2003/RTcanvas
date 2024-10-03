// app/canvas/[id]/page.tsx
"use client";

import { useParams, useRouter } from 'next/navigation';
import MultiCanvas from '../../components/Multicanvas'; // Update this path to where your MultiCanvas component is
import { useEffect } from 'react';
import Link from 'next/link'; // Import Link from next/link

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
    <div>
      <h1>Canvas Room: {id}</h1>
      
      {/* Pass the canvas room ID to the MultiCanvas component */}
      <MultiCanvas canvasRoomId={id as string} />
      
      {/* Link to return to the homepage */}
      <div className="mt-4">
        <Link href="/">
          <div className="text-blue-500 underline">Return to Homepage</div>
        </Link>
      </div>
    </div>
  );
};

export default CanvasPage;
