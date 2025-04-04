{ pkgs ? import <nixpkgs> {} }:

let
  fava = pkgs.callPackage ./packages/fava.nix {};
  fava-portfolio-returns = pkgs.callPackage ./packages/fava-portfolio-returns.nix {};
in pkgs.mkShell {
  buildInputs = with pkgs; [
    fava
    fava-portfolio-returns
  ];
}
