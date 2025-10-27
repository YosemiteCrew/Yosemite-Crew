import { Icon } from "@iconify/react";
import "./SidebarMenu.css";

export function SidebarContent() {
  return (
    <div className="sidebar-content">
      <div className="menu-section">
        <h4 className="section-title">What is Yosemite Crew?</h4>
      </div>
      <div className="menu-section">
        <h4 className="section-title">Yosemite Crew Serves?</h4>
      </div>

      <div className="menu-section">
        <h4 className="section-title">How Yosemite Crew Works?</h4>
        <ul>
          <li>Ultimate Convenience</li>
          <li>Enhanced Accessibility</li>
          <li>Streamlined Efficiency</li>
          <li>Customization & Integration</li>
          <li>Robust Security & Compliance</li>
          <li>Scalability & Support</li>
        </ul>
      </div>

      <div className="menu-section">
        <h4 className="section-title">For Developer</h4>
        <ul>
          <li>Empowering Innovation</li>
          <li>Flexible Development Environment</li>
          <li>Community-Driven Growth</li>
        </ul>
      </div>
    </div>
  );
}

function SidebarMenu() {
  return (
    <div className="sidebar-menu">
      <SearchInput />
      <SidebarContent />
    </div>
  );
}

export default SidebarMenu;

export const SearchInput = ({
  onFocus,
  onBlur,
}: {
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}) => {
  return (
    <form className="search-form">
      <div className="input-wrapper">
        <Icon
          icon="mdi:magnify"
          width="25"
          height="25"
          className="search-icon"
        />
        <input
          type="text"
          placeholder="Search"
          className="search-input"
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </div>
    </form>
  );
};
