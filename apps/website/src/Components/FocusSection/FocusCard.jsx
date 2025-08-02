import PropTypes from "prop-types";

FocusCard.propTypes = {
  Focimg: PropTypes.string.isRequired,
  focname: PropTypes.string.isRequired,
  focpara: PropTypes.string.isRequired,
  focadcls: PropTypes.string,
};

function FocusCard({ Focimg, focname, focpara, focadcls = "" }) {
  return (
    <div className={`FocusItem ${focadcls}`}>
      <img src={Focimg} alt={focname} width={100} height={100} />
      <div className="focusText">
        <h4>{focname}</h4>
        <p>{focpara}</p>
      </div>
    </div>
  );
}

export default FocusCard;