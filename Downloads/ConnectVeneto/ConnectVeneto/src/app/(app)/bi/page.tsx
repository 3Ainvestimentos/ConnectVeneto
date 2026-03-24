export default function BIPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-grow relative w-full h-full">
        <iframe
          title="Veneto Dashboard"
          width="100%"
          height="100%"
          src="https://dashboard.3arivaconnect.com.br/pages/login.html"
          frameBorder="0"
          allowFullScreen={true}
          allow="fullscreen; clipboard-read; clipboard-write; autoplay"
          className="border-0 rounded-none w-full h-full absolute inset-0"
        />
      </div>
    </div>
  );
}
