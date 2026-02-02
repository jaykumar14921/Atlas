import './navBarComponent.css';

export function NavBarComponent({ onRefresh, onDeviceChange }) {
  return (
    <div className="d-flex justify-content-between mx-3 my-3 text-center bg-black py-2 rounded shadow-sm">
      <p id="name">&lt;Horizon/&gt;</p>
      <div className='mt-3'>
        {/* Download (Zip) Button */}
      <button id="btnZip" className="btn bi bi-download btn-sm mx-2">
        zip
      </button>

      {/* Back Button */}
      <button className="btn btn-sm custom-inverted-btn bi bi-arrow-bar-left me-5"></button>

      {/* Device Toggle Buttons */}
      <div className="btn-group mx-4" role="group" aria-label="Device toggle button group">
        <input
          type="radio"
          className="btn-check"
          name="btnradio"
          id="btnradio1"
          autoComplete="off"
          defaultChecked
          onChange={() => onDeviceChange("desktop")}
        />
        <label className="btn btn-sm btn-outline-dark bi bi-laptop" htmlFor="btnradio1">
          Desktop
        </label>

        <input
          type="radio"
          className="btn-check"
          name="btnradio"
          id="btnradio2"
          autoComplete="off"
          onChange={() => onDeviceChange("mobile")}
        />
        <label className="btn btn-sm btn-outline-dark bi bi-phone" htmlFor="btnradio2">
          Mobile
        </label>
      </div>

      {/* Refresh Button */}
      <button
        className="btn btn-sm custom-inverted-btn bi bi-arrow-repeat"
        onClick={onRefresh}
        title="Reload Preview"
      >
        Refresh Preview
      </button>
      </div>
      <button id="btnPerson"
  className="btn btn-outline-primary rounded-circle bi bi-person-fill me-5 mt-2"
  style={{
    width: "40px",      // Fixed width
    height: "40px",     // Same as width
    padding: "0",       // Remove extra padding
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }}></button>
    </div>
  );
}
