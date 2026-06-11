import React from "react";
import { Navbar, Nav, NavDropdown } from "react-bootstrap";
import siteStructure from "./site-structure.json";
import "./Navbar.css";

function NavBar() {
  return (
    <Navbar expand="lg" className="custom-navbar">
      <Navbar.Toggle aria-controls="main-navbar" />
      <Navbar.Collapse id="main-navbar">
        <Nav className="me-auto">
          {siteStructure.map((item) => (
            <NavDropdown
              key={item.url}
              title={item.label}
              id={`nav-${item.url}`}
              className="custom-dropdown"
            >
              {item.children.map((child) => (
                <NavDropdown.Item
                  key={child.url}
                  href={`/${item.url}/${child.url}`}
                  title={child.tooltip}
                  className="custom-dropdown-item"
                >
                  {child.label}
                </NavDropdown.Item>
              ))}
            </NavDropdown>
          ))}
        </Nav>
      </Navbar.Collapse>
    </Navbar>
  );
}

export default NavBar;
