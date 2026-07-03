import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-6">
      <h1 className="text-center text-4xl font-bold">My Kitchen</h1>
      <p className="max-w-md text-lg text-gray-600">Fresh, homemade meals prepared with love.</p>
      <Link
        to="/menu"
        className="inline-block rounded-lg bg-green-600 px-4 py-2 text-white transition hover:bg-green-700"
      >
        View Menu
      </Link>
      <Link
        to="/contact"
        className="inline-block rounded-lg bg-gray-200 px-4 py-2 text-gray-800 transition hover:bg-gray-300"
      >
        Contact Us
      </Link>
    </div>
  );
}