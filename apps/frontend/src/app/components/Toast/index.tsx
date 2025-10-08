import React, { useState } from "react";
import { Button, Container } from "react-bootstrap";

import { Icon } from "@iconify/react/dist/iconify.js";

type ErrorTostProps = {
  message?: string;
  iconElement?: React.ReactNode;
  errortext: string;
  className?: string;
  onClose?: () => void;
};

const ErrorTost: React.FC<ErrorTostProps> = ({
  message,
  iconElement,
  errortext,
  className = "",
  onClose,
}) => {
  return (
    <div className={`SignError ${className}`}>
      <Container>
        <div className="ErroItemDiv">
          <div className="errortopbar">
            <div className="Errortexted">
              {iconElement}
              <h6>{errortext}</h6>
            </div>
            <p>{message}</p>
          </div>
          <Button onClick={onClose} variant="light">
            <Icon icon="solar:close-circle-bold" width="24" height="24" />
          </Button>
        </div>
      </Container>
    </div>
  );
};

const useErrorTost = () => {
  const [errorTost, setErrorTost] = useState<{
    show: boolean;
    message?: string;
    errortext?: string;
    iconElement?: React.ReactNode;
    className?: string;
  }>({ show: false });

  const showErrorTost = ({
    message,
    errortext,
    iconElement,
    className = "",
    duration = 5000,
  }: {
    message: string;
    errortext: string;
    iconElement: React.ReactNode;
    className?: string;
    duration?: number;
  }) => {
    setErrorTost({ show: true, message, errortext, iconElement, className });
    setTimeout(() => setErrorTost({ show: false }), duration);
  };

  const ErrorTostPopup = errorTost.show ? (
    <ErrorTost
      className={errorTost.className || ""}
      message={errorTost.message || ""}
      errortext={errorTost.errortext || ""}
      iconElement={errorTost.iconElement}
      onClose={() => setErrorTost({ show: false })}
    />
  ) : null;

  return { showErrorTost, ErrorTostPopup };
};

export { ErrorTost, useErrorTost };
