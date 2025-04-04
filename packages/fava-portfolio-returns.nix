{ pkgs ? import <nixpkgs> {} }:

let
  beancount3 = pkgs.callPackage ./beancount3.nix {};
  beangrow= pkgs.callPackage ./beangrow.nix {};
  fava = pkgs.callPackage ./fava.nix {};
in pkgs.python3Packages.buildPythonPackage rec {
  pname = "fava-portfolio-returns";
  version = "0.0.0";
  format = "pyproject";

  src = pkgs.fetchFromGitHub {
    owner = "andreasgerstmayr";
    repo = pname;
    rev = "733e9972aea01c396786f03989f600a973d12127";
    sha256 = "sha256-R8wt91xOtqcFMPA17a5YTtl3PTHQDPzQfNdFbNfNPqk=";
  };


  propagatedBuildInputs = with pkgs.python3Packages; [
    pip

    hatchling
    hatch-vcs


    fava
    beancount3
    beangrow
  ];

  meta = with pkgs.lib; {
    description = "Shows portfolio returns in the Fava web interface";
    homepage = "https://github.com/andreasgerstmayr/fava-portfolio-returns";
    license = licenses.gpl2Only;
  };
}

