import PropTypes from "prop-types";
import { Link } from "react-router-dom";

export function FillBtn({ FilName, FilIcon, Filhref }) {
  return (
    <Link className="Fillbtn" to={Filhref}>
      <i className={FilIcon}></i> {FilName}
    </Link>
  );
}

FillBtn.propTypes = {
  FilName: PropTypes.string.isRequired,
  FilIcon: PropTypes.string.isRequired,
  Filhref: PropTypes.string.isRequired,
};
