import './navBarComponent.css';
import mountain from '../../assets/mountain.png'
export function NavBarComponent({
  onRefresh,
  onDeviceChange,
  onDownloadZip,
  onToggleFullscreen,
  isFullscreen,
}) {
  return (
    <div className="d-flex justify-content-between align-items-center mx-3 text-center bg-black py-2 rounded shadow-sm">
      {/* Left Section */}
      <div className="d-flex align-items-center w-100">
       
         <div className='d-flex align-items-center' style={{marginRight: "16%"}}>
            <img src={mountain} alt="" className="" style={{ width: "67px" }}/>
            <p id="name" className="m-0" style={{ fontFamily: "Arial" }}> Atlas</p>
        </div>

        {/* Zip & Fullscreen Buttons */}
        <div className="d-flex align-items-center ms-5">
          <button
            id="btnZip"
            className="btn bi bi-download btn-sm mx-2"
            onClick={onDownloadZip}
            title="Download Project as ZIP"
          >
            &nbsp;zip
          </button>

          <button
            id="fullScreen"
            className={`btn btn-sm me-4 ${
              isFullscreen ? 'btn-light' : 'custom-inverted-btn'
            }`}
            onClick={onToggleFullscreen}
            title={
              isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'
            }
          >
            {isFullscreen ? (<><i className="bi bi-fullscreen-exit"></i>&nbsp;&nbsp;Exit Fullscreen</>): (<><i className="bi bi-fullscreen"></i>&nbsp;&nbsp;Fullscreen</>)}
            
          </button>
        </div>

        {/* Device & Refresh Buttons - Centered with proper alignment */}
        <div className="d-flex align-items-center justify-content-center flex-grow-1" style={{ gap: '10px' }}>
          <div className="btn-group" role="group" aria-label="Device toggle button group">
            <input
              type="radio"
              className="btn-check"
              name="btnradio"
              id="btnradio1"
              autoComplete="off"
              defaultChecked
              onChange={() => onDeviceChange('desktop')}
            />
            <label
              className="btn btn-sm btn-outline-dark bi bi-laptop"
              htmlFor="btnradio1"
            >
              &nbsp;Desktop
            </label>

            <input
              type="radio"
              className="btn-check"
              name="btnradio"
              id="btnradio2"
              autoComplete="off"
              onChange={() => onDeviceChange('mobile')}
            />
            <label
              className="btn btn-sm btn-outline-dark bi bi-phone"
              htmlFor="btnradio2"
            >
              &nbsp;Mobile
            </label>
          </div>

          <button
            className="btn btn-sm custom-inverted-btn bi bi-arrow-repeat"
            onClick={onRefresh}
            title="Reload Preview"
          >
            &nbsp;Refresh Preview
          </button>
        </div>
      </div>

      {/* Profile Button */}
      {/* <button
        id="btnPerson"
        className="btn btn-outline-primary rounded-circle bi bi-person-fill"
        style={{
          width: '40px',
          height: '40px',
          padding: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      ></button> */}
    </div>
  );
}